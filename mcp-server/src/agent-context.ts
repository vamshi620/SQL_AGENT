export const SKILL_CONTEXT: Record<string, { purpose: string; rules: string[] }> = {
  'schema-analysis': {
    purpose: 'Analyze SQL Server schema shape, relations, and health indicators.',
    rules: [
      'Inventory tables, PK/FK, nullable key columns, and index coverage.',
      'Include only request-relevant entities in outputs.',
      'Flag critical/major/minor schema risks explicitly.'
    ]
  },
  'sql-tsql-standards': {
    purpose: 'Enforce SQL Server coding, security, and performance standards.',
    rules: [
      'Use NVARCHAR, DATETIME2(7), DECIMAL(18,4).',
      'Use SET NOCOUNT ON and SET XACT_ABORT ON in procedures.',
      'Use TRY/CATCH with explicit transaction handling for multi-statement DML.'
    ]
  },
  'sql-test-patterns': {
    purpose: 'Define SQL unit test patterns and coverage expectations.',
    rules: [
      'Cover happy path, null/invalid, boundary, FK and duplicate scenarios.',
      'Capture expected outcomes and failure diagnostics.',
      'Persist evidence as CSV/report artifacts.'
    ]
  },
  'docx-document-writer': {
    purpose: 'Produce consistent Word reports for requirements/review/testing.',
    rules: [
      'Include summary, scope, detailed findings, and recommendations.',
      'Use structured sections and tables for auditability.',
      'Return generated output file path.'
    ]
  },
  'agent-handoff': {
    purpose: 'Provide handoff-ready output for next pipeline stage.',
    rules: [
      'Return stage status and generated artifact paths.',
      'Identify next stage expected inputs.',
      'Highlight risks and follow-up actions.'
    ]
  }
};

export const HOOK_CONTEXT: Record<string, string> = {
  'security-gate': 'Blocks destructive SQL patterns before execution unless explicitly confirmed and dry-run validated.',
  'dry-run-enforcer': 'Requires dryRun=true at least once in session before dryRun=false SQL execution.',
  'audit-logger': 'Appends pre/post agent execution events with timestamps to logs/agent-audit.log.',
  'session-context': 'Maintains session state and stage status for orchestrated calls.'
};

export const PROMPT_CONTEXT: Record<string, string> = {
  'new-pipeline': 'Start a new end-to-end SQL feature pipeline through orchestrator.',
  'run-full-pipeline': 'Run all stages sequentially with explicit artifacts.',
  'db-health-check': 'Run schema inventory and health checks using schema-analysis rules.',
  'generate-unit-tests': 'Generate and execute unit test suite aligned with sql-test-patterns.'
};

export const AGENT_CONTEXT: Record<string, {
  description: string;
  skills: string[];
  prompts: string[];
  hooks: string[];
  outputs: string[];
}> = {
  'e2e-orchestrator': {
    description: 'Main entry point that initializes and tracks end-to-end pipeline state.',
    skills: ['schema-analysis', 'agent-handoff'],
    prompts: ['new-pipeline', 'run-full-pipeline'],
    hooks: ['session-context', 'audit-logger'],
    outputs: ['workspace/MEMORY.md', 'workspace/output/pipeline-summary-*.docx']
  },
  'requirements-agent': {
    description: 'Build requirements artifact from feature request and live schema context.',
    skills: ['schema-analysis', 'docx-document-writer', 'agent-handoff'],
    prompts: ['new-pipeline'],
    hooks: ['audit-logger', 'session-context'],
    outputs: ['workspace/output/requirements-*.docx', 'workspace/MEMORY.md']
  },
  'sql-impl-agent': {
    description: 'Validates and executes SQL changes with dry-run safety and script persistence.',
    skills: ['sql-tsql-standards', 'agent-handoff'],
    prompts: ['run-full-pipeline'],
    hooks: ['dry-run-enforcer', 'security-gate', 'audit-logger'],
    outputs: ['workspace/sql/*.sql', 'run_sql execution results']
  },
  'code-review-agent': {
    description: 'Performs standards/security/performance checks and generates review report.',
    skills: ['sql-tsql-standards', 'docx-document-writer', 'agent-handoff'],
    prompts: ['run-full-pipeline'],
    hooks: ['audit-logger'],
    outputs: ['workspace/output/code-review-*.docx']
  },
  'unit-test-agent': {
    description: 'Executes DB tests and produces CSV + Word evidence artifacts.',
    skills: ['sql-test-patterns', 'docx-document-writer', 'agent-handoff'],
    prompts: ['generate-unit-tests', 'run-full-pipeline'],
    hooks: ['audit-logger'],
    outputs: ['workspace/*.csv', 'workspace/output/test-report-*.docx']
  }
};
