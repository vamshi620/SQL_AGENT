import { AGENT_CONTEXT, HOOK_CONTEXT, PROMPT_CONTEXT, SKILL_CONTEXT } from '../agent-context.js';
import { getDbSchema } from './db-schema.js';
import { runSql } from './run-sql.js';
import { generateWordDoc } from './generate-docx.js';
import { runUnitTests, type TestCaseDefinition } from './run-tests.js';
import { saveCsv } from './save-csv.js';
import { readFile, writeFile } from './file-system.js';

const AGENT_STATE_FILE = '.mcp-agent-state.json';
const AUDIT_LOG_FILE = 'logs/agent-audit.log';

type AgentName =
  | 'e2e-orchestrator'
  | 'requirements-agent'
  | 'sql-impl-agent'
  | 'code-review-agent'
  | 'unit-test-agent';

interface AgentSessionState {
  hasDryRun: boolean;
}

interface AgentState {
  sessions: Record<string, AgentSessionState>;
}

interface RequirementsInput {
  featureRequest: string;
  tables?: string[];
  author?: string;
  outputFilename?: string;
  sessionId?: string;
}

interface SqlImplInput {
  sqlScript: string;
  dryRun?: boolean;
  database?: string;
  saveScriptPath?: string;
  sessionId?: string;
}

interface CodeReviewInput {
  sqlText?: string;
  sqlFilePath?: string;
  outputFilename?: string;
  author?: string;
  sessionId?: string;
}

interface UnitTestInput {
  testCases: TestCaseDefinition[];
  reportFilename?: string;
  testCasesCsvFilename?: string;
  snapshotsCsvFilename?: string;
  author?: string;
  sessionId?: string;
}

interface OrchestratorInput {
  featureRequest: string;
  tables?: string[];
  outputFilename?: string;
  sessionId?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'feature';
}

function getString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function getStringArray(payload: Record<string, unknown>, key: string): string[] | undefined {
  const value = payload[key];
  if (!Array.isArray(value)) return undefined;
  if (!value.every(item => typeof item === 'string')) return undefined;
  return value;
}

function parseTestCases(payload: Record<string, unknown>): TestCaseDefinition[] {
  const value = payload.testCases;
  if (!Array.isArray(value)) {
    throw new Error('testCases must be an array for unit-test-agent.');
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`testCases[${index}] must be an object.`);
    }
    const t = item as Record<string, unknown>;
    const testId = typeof t.testId === 'string' ? t.testId : undefined;
    const testName = typeof t.testName === 'string' ? t.testName : undefined;
    const sql = typeof t.sql === 'string' ? t.sql : undefined;
    const expectedOutcome = typeof t.expectedOutcome === 'string' ? t.expectedOutcome : undefined;
    const snapshotSql = typeof t.snapshotSql === 'string' ? t.snapshotSql : undefined;

    if (!testId || !testName || !sql || !expectedOutcome) {
      throw new Error(`testCases[${index}] is missing required fields.`);
    }

    return { testId, testName, sql, expectedOutcome, snapshotSql };
  });
}

function readAgentState(): AgentState {
  const existing = readFile({ filePath: AGENT_STATE_FILE });
  if (!existing.exists || !existing.content.trim()) {
    return { sessions: {} };
  }

  try {
    const parsed = JSON.parse(existing.content) as AgentState;
    if (!parsed.sessions || typeof parsed.sessions !== 'object') {
      return { sessions: {} };
    }
    return parsed;
  } catch {
    return { sessions: {} };
  }
}

function writeAgentState(state: AgentState): void {
  writeFile({
    filePath: AGENT_STATE_FILE,
    content: JSON.stringify(state, null, 2),
    append: false,
  });
}

function appendAudit(stage: 'PRE' | 'POST', agent: AgentName, sessionId: string, inputSummary: string): void {
  const line = `[${nowIso()}] ${stage} | session=${sessionId} | agent=${agent} | input=${inputSummary}\n`;
  writeFile({ filePath: AUDIT_LOG_FILE, content: line, append: true });
}

function readSqlText(input: CodeReviewInput): string {
  if (input.sqlText && input.sqlText.trim()) {
    return input.sqlText;
  }
  if (input.sqlFilePath) {
    const file = readFile({ filePath: input.sqlFilePath });
    if (!file.exists) {
      throw new Error(`sqlFilePath not found: ${input.sqlFilePath}`);
    }
    return file.content;
  }
  throw new Error('code-review-agent requires sqlText or sqlFilePath.');
}

function analyzeSqlStandards(sqlText: string): {
  critical: string[];
  major: string[];
  minor: string[];
  score: number;
  recommendation: 'Approve' | 'Request Changes' | 'Reject';
} {
  const critical: string[] = [];
  const major: string[] = [];
  const minor: string[] = [];

  if (/\bDROP\s+TABLE\b/i.test(sqlText) || /\bTRUNCATE\s+TABLE\b/i.test(sqlText)) {
    critical.push('Destructive statement detected (DROP/TRUNCATE).');
  }
  if (/\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/i.test(sqlText)) {
    critical.push('DELETE detected without WHERE safeguard.');
  }

  if (/\bCREATE\s+(OR\s+ALTER\s+)?PROCEDURE\b/i.test(sqlText) && !/SET\s+NOCOUNT\s+ON/i.test(sqlText)) {
    major.push('Stored procedure is missing SET NOCOUNT ON.');
  }
  if (/\bCREATE\s+(OR\s+ALTER\s+)?PROCEDURE\b/i.test(sqlText) && !/SET\s+XACT_ABORT\s+ON/i.test(sqlText)) {
    major.push('Stored procedure is missing SET XACT_ABORT ON.');
  }
  if (/\bSELECT\s+\*/i.test(sqlText)) {
    major.push('SELECT * usage found; explicit column list is recommended.');
  }
  if (/\bVARCHAR\s*\(/i.test(sqlText)) {
    major.push('VARCHAR detected; NVARCHAR is preferred for text data.');
  }

  if (/\bDATETIME\b/i.test(sqlText) && !/\bDATETIME2\b/i.test(sqlText)) {
    minor.push('DATETIME detected; DATETIME2(7) is preferred.');
  }
  if (/\bMONEY\b/i.test(sqlText)) {
    minor.push('MONEY detected; DECIMAL(18,4) is preferred.');
  }

  let score = 100;
  score -= critical.length * 30;
  score -= major.length * 12;
  score -= minor.length * 5;
  if (score < 0) score = 0;

  let recommendation: 'Approve' | 'Request Changes' | 'Reject' = 'Approve';
  if (critical.length > 0) recommendation = 'Reject';
  else if (major.length > 0) recommendation = 'Request Changes';

  return { critical, major, minor, score, recommendation };
}

async function runRequirementsAgent(payload: Record<string, unknown>) {
  const input: RequirementsInput = {
    featureRequest: getString(payload, 'featureRequest') ?? '',
    tables: getStringArray(payload, 'tables'),
    author: getString(payload, 'author'),
    outputFilename: getString(payload, 'outputFilename'),
    sessionId: getString(payload, 'sessionId'),
  };

  if (!input.featureRequest.trim()) {
    throw new Error('requirements-agent requires featureRequest.');
  }

  const schema = await getDbSchema(input.tables);
  const slug = safeSlug(input.featureRequest);
  const filename = input.outputFilename ?? `requirements-${slug}-${todayDate()}.docx`;

  const doc = await generateWordDoc({
    filename,
    title: `Requirements - ${input.featureRequest}`,
    subtitle: 'Generated by MCP requirements-agent',
    author: input.author,
    sections: [
      {
        heading: 'Executive Summary',
        level: 1,
        content: `Feature request: ${input.featureRequest}\n- Generated using MCP requirements-agent\n- Schema inspected at ${schema.fetchedAt}`,
      },
      {
        heading: 'Scope',
        level: 1,
        content: '- In scope: Requirements decomposition\n- In scope: Related schema inventory\n- Out of scope: Non-requested destructive changes',
      },
      {
        heading: 'Functional Requirements',
        level: 1,
        content: '1. Define expected data operations\n2. Define validation and error behavior\n3. Define success criteria and outputs',
      },
      {
        heading: 'Database Impact Analysis',
        level: 1,
        content: `Relevant tables discovered: ${schema.tables.length}`,
        table: {
          headers: ['Schema', 'Table', 'Columns', 'RowCount'],
          rows: schema.tables.slice(0, 25).map(t => [
            t.schema,
            t.tableName,
            String(t.columns.length),
            String(t.rowCount ?? 0),
          ]),
        },
      },
      {
        heading: 'Recommendations',
        level: 1,
        content: '1. Validate SQL with dryRun before execution\n2. Add targeted unit test cases for affected procedures/tables\n3. Capture output artifacts for audit trail',
      },
    ],
  });

  const memoryContent = [
    '# MCP Pipeline Memory',
    `- Feature: ${input.featureRequest}`,
    `- Stage: Requirements Completed`,
    `- RequirementsDoc: ${doc.filePath}`,
    `- SchemaTables: ${schema.tables.length}`,
    `- UpdatedAt: ${nowIso()}`,
  ].join('\n');

  writeFile({ filePath: 'MEMORY.md', content: `${memoryContent}\n`, append: false });

  return {
    stage: 'requirements',
    skillsApplied: AGENT_CONTEXT['requirements-agent'].skills,
    hooksApplied: AGENT_CONTEXT['requirements-agent'].hooks,
    output: {
      requirementsDoc: doc.filePath,
      memoryFile: 'workspace/MEMORY.md',
      schemaTableCount: schema.tables.length,
    },
  };
}

async function runSqlImplAgent(payload: Record<string, unknown>) {
  const input: SqlImplInput = {
    sqlScript: getString(payload, 'sqlScript') ?? '',
    dryRun: typeof payload.dryRun === 'boolean' ? payload.dryRun : true,
    database: getString(payload, 'database'),
    saveScriptPath: getString(payload, 'saveScriptPath'),
    sessionId: getString(payload, 'sessionId'),
  };

  if (!input.sqlScript.trim()) {
    throw new Error('sql-impl-agent requires sqlScript.');
  }

  const scriptPath = input.saveScriptPath ?? `sql/sql-impl-${Date.now()}.sql`;
  writeFile({ filePath: scriptPath, content: input.sqlScript, append: false });

  const state = readAgentState();
  const sessionId = input.sessionId ?? 'default';
  state.sessions[sessionId] = state.sessions[sessionId] ?? { hasDryRun: false };

  if (!input.dryRun && !state.sessions[sessionId].hasDryRun) {
    return {
      stage: 'sql-implementation',
      blocked: true,
      reason: 'Dry-run required first for this session. Run sql-impl-agent with dryRun=true before dryRun=false.',
      hooksApplied: AGENT_CONTEXT['sql-impl-agent'].hooks,
      output: {
        scriptFile: `workspace/${scriptPath}`,
      },
    };
  }

  const result = await runSql({
    sqlScript: input.sqlScript,
    dryRun: input.dryRun,
    database: input.database,
  });

  if (input.dryRun) {
    state.sessions[sessionId].hasDryRun = true;
    writeAgentState(state);
  }

  return {
    stage: 'sql-implementation',
    blocked: false,
    skillsApplied: AGENT_CONTEXT['sql-impl-agent'].skills,
    hooksApplied: AGENT_CONTEXT['sql-impl-agent'].hooks,
    output: {
      scriptFile: `workspace/${scriptPath}`,
      execution: result,
    },
  };
}

async function runCodeReviewAgent(payload: Record<string, unknown>) {
  const input: CodeReviewInput = {
    sqlText: getString(payload, 'sqlText'),
    sqlFilePath: getString(payload, 'sqlFilePath'),
    outputFilename: getString(payload, 'outputFilename'),
    author: getString(payload, 'author'),
    sessionId: getString(payload, 'sessionId'),
  };

  const sqlText = readSqlText(input);
  const analysis = analyzeSqlStandards(sqlText);
  const filename = input.outputFilename ?? `code-review-sql-${todayDate()}.docx`;

  const criticalRows = analysis.critical.length > 0 ? analysis.critical.map((issue, i) => [String(i + 1), issue, 'Review SQL script and apply safeguard']) : [['-', 'No critical issues found', '-']];
  const majorRows = analysis.major.length > 0 ? analysis.major.map((issue, i) => [String(i + 1), issue, 'Update SQL to align with standards']) : [['-', 'No major issues found', '-']];
  const minorRows = analysis.minor.length > 0 ? analysis.minor.map((issue, i) => [String(i + 1), issue, 'Optional improvement']) : [['-', 'No minor issues found', '-']];

  const doc = await generateWordDoc({
    filename,
    title: 'SQL Code Review Report',
    subtitle: 'Generated by MCP code-review-agent',
    author: input.author,
    sections: [
      {
        heading: 'Review Summary',
        level: 1,
        content: 'MCP-based static standards review completed.',
        table: {
          headers: ['Item', 'Value'],
          rows: [
            ['Quality Score', `${analysis.score}/100`],
            ['Recommendation', analysis.recommendation],
            ['Critical Issues', String(analysis.critical.length)],
            ['Major Issues', String(analysis.major.length)],
            ['Minor Issues', String(analysis.minor.length)],
          ],
        },
      },
      {
        heading: 'Critical Issues',
        level: 1,
        content: analysis.critical.length ? 'Critical findings detected.' : 'No critical issues found. ✅',
        table: {
          headers: ['#', 'Issue', 'Fix'],
          rows: criticalRows,
        },
      },
      {
        heading: 'Major Issues',
        level: 1,
        content: analysis.major.length ? 'Major findings detected.' : 'No major issues found. ✅',
        table: {
          headers: ['#', 'Issue', 'Fix'],
          rows: majorRows,
        },
      },
      {
        heading: 'Minor Issues',
        level: 1,
        content: analysis.minor.length ? 'Minor findings detected.' : 'No minor issues found. ✅',
        table: {
          headers: ['#', 'Issue', 'Suggestion'],
          rows: minorRows,
        },
      },
      {
        heading: 'Recommendations',
        level: 1,
        content: '1. Fix all critical and major findings first\n2. Re-run review after SQL updates\n3. Execute unit tests after review approval',
      },
    ],
  });

  return {
    stage: 'code-review',
    skillsApplied: AGENT_CONTEXT['code-review-agent'].skills,
    hooksApplied: AGENT_CONTEXT['code-review-agent'].hooks,
    output: {
      reviewDoc: doc.filePath,
      score: analysis.score,
      recommendation: analysis.recommendation,
      findings: {
        critical: analysis.critical,
        major: analysis.major,
        minor: analysis.minor,
      },
    },
  };
}

async function runUnitTestAgent(payload: Record<string, unknown>) {
  const input: UnitTestInput = {
    testCases: parseTestCases(payload),
    reportFilename: getString(payload, 'reportFilename'),
    testCasesCsvFilename: getString(payload, 'testCasesCsvFilename'),
    snapshotsCsvFilename: getString(payload, 'snapshotsCsvFilename'),
    author: getString(payload, 'author'),
    sessionId: getString(payload, 'sessionId'),
  };

  const result = await runUnitTests(input.testCases);

  const testCasesCsv = saveCsv({
    filename: input.testCasesCsvFilename ?? `TestCases_${todayDate()}`,
    headers: ['TestId', 'TestName', 'Status', 'DurationMs', 'RowsAffected', 'ErrorMessage'],
    rows: result.testResults.map(t => [
      t.testId,
      t.testName,
      t.status,
      t.durationMs,
      t.rowsAffected,
      t.errorMessage ?? '',
    ]),
  });

  const snapshotRows: (string | number | boolean | null)[][] = [];
  for (const test of result.testResults) {
    if (!test.snapshotRows.length) {
      snapshotRows.push([test.testId, test.testName, '', '']);
      continue;
    }
    for (const row of test.snapshotRows) {
      snapshotRows.push([test.testId, test.testName, JSON.stringify(test.snapshotColumns), JSON.stringify(row)]);
    }
  }

  const snapshotsCsv = saveCsv({
    filename: input.snapshotsCsvFilename ?? `TestSnapshots_${todayDate()}`,
    headers: ['TestId', 'TestName', 'Columns', 'SnapshotRow'],
    rows: snapshotRows,
  });

  const reportDoc = await generateWordDoc({
    filename: input.reportFilename ?? `test-report-${todayDate()}.docx`,
    title: 'Unit Test Report',
    subtitle: 'Generated by MCP unit-test-agent',
    author: input.author,
    sections: [
      {
        heading: 'Test Execution Summary',
        level: 1,
        content: result.coverageSummary,
        table: {
          headers: ['Metric', 'Value'],
          rows: [
            ['Total Tests', String(result.totalTests)],
            ['Passed', String(result.passed)],
            ['Failed', String(result.failed)],
            ['Errors', String(result.errors)],
            ['DurationMs', String(result.durationMs)],
          ],
        },
      },
      {
        heading: 'Test Results Detail',
        level: 1,
        content: 'Per-test execution output.',
        table: {
          headers: ['TestId', 'TestName', 'Status', 'DurationMs', 'RowsAffected', 'ErrorMessage'],
          rows: result.testResults.map(t => [
            t.testId,
            t.testName,
            t.status,
            String(t.durationMs),
            String(t.rowsAffected),
            t.errorMessage ?? '',
          ]),
        },
      },
      {
        heading: 'Failure Analysis',
        level: 1,
        content: result.testResults.filter(t => t.status !== 'PASS').length
          ? result.testResults
              .filter(t => t.status !== 'PASS')
              .map(t => `- ${t.testId} (${t.testName}): ${t.errorMessage ?? 'No details'}`)
              .join('\n')
          : 'No failures detected. ✅',
      },
      {
        heading: 'Recommendations',
        level: 1,
        content: '1. Fix failed/error tests\n2. Re-run tests for all changed procedures\n3. Preserve CSV and Word outputs for audit trail',
      },
    ],
  });

  return {
    stage: 'unit-test',
    skillsApplied: AGENT_CONTEXT['unit-test-agent'].skills,
    hooksApplied: AGENT_CONTEXT['unit-test-agent'].hooks,
    output: {
      testResult: result,
      testCasesCsv: testCasesCsv.filePath,
      snapshotsCsv: snapshotsCsv.filePath,
      reportDoc: reportDoc.filePath,
    },
  };
}

async function runOrchestratorAgent(payload: Record<string, unknown>) {
  const input: OrchestratorInput = {
    featureRequest: getString(payload, 'featureRequest') ?? '',
    tables: getStringArray(payload, 'tables'),
    outputFilename: getString(payload, 'outputFilename'),
    sessionId: getString(payload, 'sessionId'),
  };

  if (!input.featureRequest.trim()) {
    throw new Error('e2e-orchestrator requires featureRequest.');
  }

  const schema = await getDbSchema(input.tables);
  const filename = input.outputFilename ?? `pipeline-summary-${safeSlug(input.featureRequest)}-${todayDate()}.docx`;

  const summaryDoc = await generateWordDoc({
    filename,
    title: `Pipeline Summary - ${input.featureRequest}`,
    subtitle: 'Generated by MCP e2e-orchestrator',
    sections: [
      {
        heading: 'Pipeline Summary',
        level: 1,
        content: `Feature: ${input.featureRequest}\nSchema tables reviewed: ${schema.tables.length}`,
      },
      {
        heading: 'Stage Plan',
        level: 1,
        content: '1. requirements-agent\n2. sql-impl-agent\n3. code-review-agent\n4. unit-test-agent',
      },
      {
        heading: 'Agent Context',
        level: 1,
        content: 'Agents are MCP-native and internally map skills, prompts, and hook policies.',
        table: {
          headers: ['Agent', 'Skills', 'Hooks'],
          rows: Object.entries(AGENT_CONTEXT).map(([name, meta]) => [name, meta.skills.join(', '), meta.hooks.join(', ')]),
        },
      },
      {
        heading: 'Next Actions',
        level: 1,
        content: '1. Run requirements-agent with featureRequest\n2. Run sql-impl-agent with SQL script (dryRun=true first)\n3. Run code-review-agent\n4. Run unit-test-agent',
      },
    ],
  });

  const memory = [
    '# MCP Pipeline Memory',
    `- Feature: ${input.featureRequest}`,
    `- StageStatus: requirements=pending, sql-impl=pending, code-review=pending, unit-test=pending`,
    `- OrchestratorSummary: ${summaryDoc.filePath}`,
    `- UpdatedAt: ${nowIso()}`,
  ].join('\n');
  writeFile({ filePath: 'MEMORY.md', content: `${memory}\n`, append: false });

  return {
    stage: 'orchestrator',
    skillsApplied: AGENT_CONTEXT['e2e-orchestrator'].skills,
    hooksApplied: AGENT_CONTEXT['e2e-orchestrator'].hooks,
    output: {
      summaryDoc: summaryDoc.filePath,
      memoryFile: 'workspace/MEMORY.md',
      schemaTableCount: schema.tables.length,
      nextAgents: ['requirements-agent', 'sql-impl-agent', 'code-review-agent', 'unit-test-agent'],
    },
  };
}

export function listMcpContext() {
  return {
    agents: AGENT_CONTEXT,
    skills: SKILL_CONTEXT,
    prompts: PROMPT_CONTEXT,
    hooks: HOOK_CONTEXT,
  };
}

export async function runMcpAgent(agent: AgentName, payload: Record<string, unknown>) {
  const sessionId = (typeof payload.sessionId === 'string' && payload.sessionId.trim()) ? payload.sessionId : 'default';
  appendAudit('PRE', agent, sessionId, JSON.stringify(payload).slice(0, 300));

  try {
    let result: unknown;

    switch (agent) {
      case 'e2e-orchestrator':
        result = await runOrchestratorAgent(payload);
        break;
      case 'requirements-agent':
        result = await runRequirementsAgent(payload);
        break;
      case 'sql-impl-agent':
        result = await runSqlImplAgent(payload);
        break;
      case 'code-review-agent':
        result = await runCodeReviewAgent(payload);
        break;
      case 'unit-test-agent':
        result = await runUnitTestAgent(payload);
        break;
      default:
        throw new Error(`Unsupported agent: ${agent}`);
    }

    appendAudit('POST', agent, sessionId, 'success');
    return {
      agent,
      sessionId,
      timestamp: nowIso(),
      result,
    };
  } catch (err) {
    appendAudit('POST', agent, sessionId, 'error');
    throw err;
  }
}
