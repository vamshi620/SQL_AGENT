import { getSqlModule, connectToDb } from '../db.js';

const sql = getSqlModule();

export interface RunSqlOptions {
  sqlScript: string;
  dryRun?: boolean;          // If true, only validate — do not execute
  transactional?: boolean;   // Wrap in BEGIN/ROLLBACK for safety preview
  database?: string;         // Override target database
}

export interface RunSqlResult {
  success: boolean;
  rowsAffected: number;
  recordsets: Record<string, unknown>[][];
  messages: string[];
  error?: string;
  dryRun: boolean;
}

/**
 * MCP Tool: run_sql
 *
 * Executes a SQL script against SQL Server.
 * Safety features:
 *   - dryRun=true  → wraps in a transaction and ALWAYS rolls back
 *   - transactional=true → wraps in BEGIN TRAN; on error: ROLLBACK
 *
 * Statements are split on GO (batch separator) to support DDL scripts.
 */
export async function runSql(options: RunSqlOptions): Promise<RunSqlResult> {
  const { sqlScript, dryRun = false, transactional = true, database } = options;

  const pool = await connectToDb(database);
  const messages: string[] = [];
  const recordsets: Record<string, unknown>[][] = [];
  let totalRowsAffected = 0;

  // Listen to SQL Server PRINT / RAISERROR messages
  pool.on('infoMessage', (info: any) => {
    messages.push(`[INFO] ${info.message}`);
  });

  // Split script on GO (case-insensitive, standalone on its own line)
  const batches = sqlScript
    .split(/^\s*GO\s*$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  if (batches.length === 0) {
    return {
      success: false,
      rowsAffected: 0,
      recordsets: [],
      messages: [],
      error: 'No SQL batches found in the provided script.',
      dryRun,
    };
  }

  const transaction = pool.transaction();

  try {
    // Always use a transaction so we can roll back on dryRun or error
    await transaction.begin();

    for (const batch of batches) {
      const request = transaction.request();
      const result = await request.query(batch);

      totalRowsAffected += result.rowsAffected.reduce((a: number, b: number) => a + b, 0);

      // mssql v11 recordsets can be an array or dict — normalize to array
      const rsets = Array.isArray(result.recordsets)
        ? result.recordsets
        : Object.values(result.recordsets as Record<string, unknown[]>);

      for (const rs of rsets) {
        recordsets.push(rs as Record<string, unknown>[]);
      }
    }

    if (dryRun) {
      // Roll back intentionally — this is a preview/validation run
      await transaction.rollback();
      messages.push('[DRY RUN] Transaction rolled back. No changes were persisted.');
      return { success: true, rowsAffected: totalRowsAffected, recordsets, messages, dryRun: true };
    }

    await transaction.commit();
    messages.push('[SUCCESS] Transaction committed successfully.');
    return { success: true, rowsAffected: totalRowsAffected, recordsets, messages, dryRun: false };

  } catch (err: unknown) {
    try {
      await transaction.rollback();
    } catch {
      // Rollback may fail if connection dropped
    }

    const errorMessage = err instanceof Error ? err.message : String(err);
    messages.push(`[ERROR] ${errorMessage}`);

    return {
      success: false,
      rowsAffected: 0,
      recordsets,
      messages,
      error: errorMessage,
      dryRun,
    };
  } finally {
    await pool.close();
  }
}
