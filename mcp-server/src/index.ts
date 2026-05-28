#!/usr/bin/env node
/**
 * E2E Copilot Agents – MCP Server
 *
 * Exposes 9 tools to GitHub Copilot agents via the Model Context Protocol:
 *   1. get_table_names  – lightweight discovery of table names and row counts
 *   2. get_db_schema    – fetch complete SQL Server schema with columns/indexes
 *   3. run_sql          – execute SQL with dry-run safety
 *   4. generate_word_doc– produce styled .docx documents
 *   5. run_unit_tests   – execute test cases directly on real SPs/tables, capture snapshots
 *   6. save_csv         – write a CSV file to the workspace/ folder
 *   7. read_file        – read any workspace file (MEMORY.md, SQL scripts, etc.)
 *   8. write_file       – create/update workspace files (MEMORY.md, SQL scripts, etc.)
 *   9. list_files       – list files in a workspace directory
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getDbSchema, getTableNames }      from './tools/db-schema.js';
import { runSql }           from './tools/run-sql.js';
import { generateWordDoc }  from './tools/generate-docx.js';
import { runUnitTests }     from './tools/run-tests.js';
import { saveCsv }          from './tools/save-csv.js';
import { readFile, writeFile, listFiles } from './tools/file-system.js';

// ── Create the MCP server ──────────────────────────────────────────────────
const server = new McpServer({
  name:    'e2e-copilot-mcp-server',
  version: '1.0.0',
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1: get_db_schema
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'get_db_schema',
  'Connects to the configured SQL Server database and returns a complete schema ' +
  'description including all tables, columns, data types, nullability, primary keys, ' +
  'foreign keys, indexes, and approximate row counts. Optionally filter to specific tables.',
  {
    tables: z
      .array(z.string())
      .optional()
      .describe('Optional list of table names to filter. Leave empty to fetch all tables.'),
  },
  async ({ tables }) => {
    try {
      const result = await getDbSchema(tables);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1b: get_table_names (lightweight discovery)
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'get_table_names',
  'Lightweight schema discovery: returns only table names and approximate row counts (no columns/indexes). ' +
  'Use this to identify relevant tables for large databases before calling get_db_schema with a filtered list. ' +
  'Significantly reduces token usage for the initial discovery phase.',
  {},
  async () => {
    try {
      const result = await getTableNames();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2: run_sql
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'run_sql',
  'Executes a SQL script against the configured SQL Server database. ' +
  'Supports GO batch separators (DDL scripts). ' +
  'Use dryRun=true to validate and preview changes WITHOUT persisting them. ' +
  'Always runs inside a transaction — rolled back automatically on error or dry run.',
  {
    sqlScript: z
      .string()
      .describe('The SQL script to execute. Use GO on its own line to separate batches.'),
    dryRun: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, runs in a transaction and always rolls back. Safe preview mode.'),
    database: z
      .string()
      .optional()
      .describe('Override the target database. Defaults to DB_DATABASE in .env.'),
  },
  async ({ sqlScript, dryRun, database }) => {
    try {
      const result = await runSql({ sqlScript, dryRun, database });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3: generate_word_doc
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'generate_word_doc',
  'Generates a professionally styled Microsoft Word (.docx) document with a cover page, ' +
  'table of contents sections, optional tables, and page numbering. ' +
  'Saves the file to the output/ directory and returns the file path.',
  {
    filename: z
      .string()
      .describe('Output filename (e.g. "requirements-v1.docx"). .docx extension added if missing.'),
    title: z
      .string()
      .describe('Document title shown on the cover page.'),
    subtitle: z
      .string()
      .optional()
      .describe('Optional subtitle shown below the title on the cover page.'),
    author: z
      .string()
      .optional()
      .describe('Author name shown on the cover page.'),
    sections: z
      .array(
        z.object({
          heading: z.string().describe('Section heading text.'),
          content: z.string().describe(
            'Section body text. Supports:\n' +
            '  - Bullet points: lines starting with "- " or "• "\n' +
            '  - Numbered lists: lines starting with "1. ", "2. " etc.\n' +
            '  - Plain paragraphs: everything else\n' +
            '  - Blank lines between items for spacing'
          ),
          level: z
            .union([z.literal(1), z.literal(2), z.literal(3)])
            .optional()
            .describe('Heading level: 1 (major), 2 (section), 3 (subsection). Default: 2.'),
          table: z
            .object({
              headers: z.array(z.string()).describe('Column header labels.'),
              rows: z.array(z.array(z.string())).describe('Table data rows.'),
            })
            .optional()
            .describe('Optional table to include after the section content.'),
        })
      )
      .describe('Array of sections to include in the document.'),
  },
  async ({ filename, title, subtitle, author, sections }) => {
    try {
      const result = await generateWordDoc({ filename, title, subtitle, author, sections });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 4: run_unit_tests
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'run_unit_tests',
  'Executes a list of test cases directly against real production stored procedures and tables. ' +
  'NO test SPs are created. NO rollback is performed — inserted/updated data persists in the DB for user review. ' +
  'After each SQL call an optional snapshotSql SELECT captures the resulting DB rows. ' +
  'Returns per-test results including status, rows affected, and snapshot data.',
  {
    testCases: z
      .array(
        z.object({
          testId:          z.string().describe('Unique identifier for this test case, e.g. "TC-001".'),
          testName:        z.string().describe('Human-readable test name, e.g. "Insert valid Claim record".'),
          sql:             z.string().describe('The SQL to execute — typically an EXEC of a real stored procedure with parameters.'),
          expectedOutcome: z.string().describe('Plain-text description of the expected result, e.g. "Row inserted with ClaimStatus = Pending".'),
          snapshotSql:     z.string().optional().describe('Optional SELECT statement to run after the main SQL to capture the resulting DB rows for review.'),
        })
      )
      .describe('Array of test case definitions to execute in order.'),
  },
  async ({ testCases }) => {
    try {
      const result = await runUnitTests(testCases);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 5: save_csv
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'save_csv',
  'Writes a CSV file to the workspace/ folder. ' +
  'Cells are properly escaped (RFC 4180). Line endings are Windows CRLF for Excel compatibility. ' +
  'Returns the absolute file path, number of data rows written, and file size in bytes.',
  {
    filename: z
      .string()
      .describe('Output filename (e.g. "TestCases_Claim_2026-05-23"). .csv extension added if missing.'),
    headers: z
      .array(z.string())
      .describe('Column header labels for the first row of the CSV.'),
    rows: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
      .describe('Data rows. Each inner array must have the same length as headers.'),
  },
  async ({ filename, headers, rows }) => {
    try {
      const result = saveCsv({ filename, headers, rows });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 6: read_file
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'read_file',
  'Reads the contents of a file from the project workspace. ' +
  'Use this to read MEMORY.md for pipeline state, SQL scripts from sql/, ' +
  'or any other text file. Returns the raw file content as a string. ' +
  'If the file does not exist, the response will say [File not found].',
  {
    filePath: z
      .string()
      .describe(
        'File path relative to the project root. ' +
        'Examples: "MEMORY.md", "sql/001_Orders.sql", "output/requirements.docx"'
      ),
  },
  async ({ filePath }) => {
    try {
      const result = readFile({ filePath });
      return {
        content: [
          {
            type: 'text' as const,
            text: result.exists
              ? result.content
              : `[File not found: ${filePath}]`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 7: write_file
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'write_file',
  'Creates or overwrites a file in the project workspace. ' +
  'Use this to create/update MEMORY.md with pipeline state, ' +
  'save generated SQL scripts to sql/, or write any other text file. ' +
  'Missing parent directories are created automatically.',
  {
    filePath: z
      .string()
      .describe(
        'File path relative to the project root. ' +
        'Examples: "MEMORY.md", "sql/001_Orders.sql"'
      ),
    content: z
      .string()
      .describe('The full text content to write to the file.'),
    append: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, appends to the file instead of overwriting. Default: false.'),
  },
  async ({ filePath, content, append }) => {
    try {
      const result = writeFile({ filePath, content, append });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 8: list_files
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'list_files',
  'Lists files in a project workspace directory. ' +
  'Use this to discover SQL scripts in sql/, Word docs in output/, ' +
  'or check what files exist anywhere in the project.',
  {
    directory: z
      .string()
      .optional()
      .default('.')
      .describe('Directory to list, relative to the project root. Default: "." (project root).'),
    pattern: z
      .string()
      .optional()
      .describe('Optional file extension filter. E.g. ".sql" lists only SQL files, ".docx" lists Word docs.'),
    recursive: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, recursively includes subdirectories. Default: false.'),
  },
  async ({ directory, pattern, recursive }) => {
    try {
      const result = listFiles({ directory, pattern, recursive });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `ERROR: ${String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Start server over stdio (VS Code uses stdio transport) ────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP server is now running and listening for tool calls from VS Code Copilot
}

main().catch((err) => {
  console.error('MCP Server failed to start:', err);
  process.exit(1);
});
