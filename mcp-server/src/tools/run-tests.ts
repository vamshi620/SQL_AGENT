import { connectToDb } from '../db.js';

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * Definition of a single test case supplied by the agent.
 * The agent crafts these from its knowledge of the SP signatures + requirements.
 */
export interface TestCaseDefinition {
  testId: string;           // e.g. "TC-001"
  testName: string;         // Human-readable label, e.g. "Insert valid Claim"
  sql: string;              // The actual EXEC / INSERT / UPDATE SQL to run (NO GO batches needed)
  expectedOutcome: string;  // Plain-text description of what success looks like
  snapshotSql?: string;     // Optional SELECT to run after execution to capture DB state
}

export interface SnapshotRow {
  [column: string]: string | number | boolean | null;
}

export interface TestCaseResult {
  testId: string;
  testName: string;
  sql: string;
  expectedOutcome: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  durationMs: number;
  rowsAffected: number;
  errorMessage?: string;
  snapshotColumns: string[];
  snapshotRows: SnapshotRow[];
}

export interface RunTestsResult {
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  durationMs: number;
  testResults: TestCaseResult[];
  coverageSummary: string;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * MCP Tool: run_unit_tests
 *
 * Executes each test case directly against real production tables and SPs.
 *
 * Key design decisions:
 *  - NO rollback / NO transaction wrapping — data persists in the DB for user review
 *  - NO test stored procedures created — real SPs are called directly
 *  - After each SQL call, an optional snapshotSql SELECT is run to capture DB state
 *  - PASS/FAIL is determined by whether the SQL executed without error
 *    (the agent sets expectedOutcome; ERROR = exception thrown)
 */
export async function runUnitTests(
  testCases: TestCaseDefinition[]
): Promise<RunTestsResult> {
  const pool = await connectToDb();
  const overallStart = Date.now();
  const testResults: TestCaseResult[] = [];

  try {
    for (const tc of testCases) {
      const caseStart = Date.now();
      let status: 'PASS' | 'FAIL' | 'ERROR' = 'PASS';
      let errorMessage: string | undefined;
      let rowsAffected = 0;
      let snapshotColumns: string[] = [];
      let snapshotRows: SnapshotRow[] = [];

      // ── Execute the test SQL (no rollback — data intentionally persists) ──
      try {
        const execResult = await pool.request().query(tc.sql);

        // Tally rows affected across all recordsets
        if (Array.isArray(execResult.rowsAffected)) {
          rowsAffected = execResult.rowsAffected.reduce(
            (sum: number, n: number) => sum + n,
            0
          );
        }

        // Check if the SP returned an explicit FAIL signal in its first recordset
        const firstRecord = execResult.recordset?.[0];
        if (
          firstRecord &&
          typeof firstRecord['Status'] === 'string' &&
          firstRecord['Status'].toUpperCase() === 'FAIL'
        ) {
          status = 'FAIL';
          errorMessage = firstRecord['ErrorMessage'] ?? 'SP returned FAIL status';
        }
      } catch (err) {
        status = 'ERROR';
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      // ── Run snapshot SELECT (always — even after errors, best-effort) ──────
      if (tc.snapshotSql) {
        try {
          const snapResult = await pool.request().query(tc.snapshotSql);
          if (snapResult.recordset && snapResult.recordset.length > 0) {
            snapshotColumns = Object.keys(snapResult.recordset[0]);
            snapshotRows = snapResult.recordset.map((row: SnapshotRow) => ({ ...row }));
          }
        } catch {
          // Snapshot failure is non-fatal — mark in error message only
          errorMessage = (errorMessage ?? '') + ' [Snapshot query failed]';
        }
      }

      testResults.push({
        testId: tc.testId,
        testName: tc.testName,
        sql: tc.sql,
        expectedOutcome: tc.expectedOutcome,
        status,
        durationMs: Date.now() - caseStart,
        rowsAffected,
        errorMessage,
        snapshotColumns,
        snapshotRows,
      });
    }

    // ── Aggregate ─────────────────────────────────────────────────────────────
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    const errors = testResults.filter(r => r.status === 'ERROR').length;
    const total  = testResults.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    return {
      totalTests: total,
      passed,
      failed,
      errors,
      durationMs: Date.now() - overallStart,
      testResults,
      coverageSummary: `${passed}/${total} tests passed (${passRate}%) — data persists in DB for review`,
    };
  } finally {
    await pool.close();
  }
}
