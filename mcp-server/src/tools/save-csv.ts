import * as fs from 'fs';
import * as path from 'path';
import { WORKSPACE_ROOT } from '../config.js';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface SaveCsvOptions {
  /** Filename only (no path). Extension .csv added automatically if missing.
   *  Example: "TestCases_Claim_2026-05-23"  */
  filename: string;

  /** Column header labels */
  headers: string[];

  /** Data rows — each cell is stringified automatically */
  rows: (string | number | boolean | null | undefined)[][];
}

export interface SaveCsvResult {
  filePath: string;
  rows: number;
  sizeBytes: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Escapes a single CSV cell value:
 *  - Wraps in double-quotes if it contains a comma, newline, or double-quote
 *  - Escapes embedded double-quotes by doubling them
 */
function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Must quote if contains comma, double-quote, newline, or carriage return
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCell).join(',');
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * MCP Tool: save_csv
 *
 * Writes a CSV file to the consolidated workspace/ folder.
 * Creates the folder if it does not exist.
 * Returns the absolute file path, row count, and file size.
 */
export function saveCsv(options: SaveCsvOptions): SaveCsvResult {
  const { filename, headers, rows } = options;

  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const workspaceDir = path.resolve(WORKSPACE_ROOT, 'workspace');

  fs.mkdirSync(workspaceDir, { recursive: true });

  const filePath = path.join(workspaceDir, safeFilename);

  const lines: string[] = [
    rowToCsv(headers),
    ...rows.map(rowToCsv),
  ];

  const csvContent = lines.join('\r\n') + '\r\n';   // Windows CRLF for Excel compatibility
  fs.writeFileSync(filePath, csvContent, 'utf-8');

  const stat = fs.statSync(filePath);

  return {
    filePath,
    rows: rows.length,
    sizeBytes: stat.size,
  };
}
