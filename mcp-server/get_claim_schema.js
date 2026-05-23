import { connectToDb } from './dist/db.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Accept table name as a CLI argument: node get_claim_schema.js <TableName>
const tableName = process.argv[2];
if (!tableName) {
  console.error('Usage: node get_claim_schema.js <TableName>');
  console.error('Example: node get_claim_schema.js Claim');
  process.exit(1);
}

async function run() {
  try {
    console.log('Connecting to database...');
    const pool = await connectToDb();
    console.log('Connected successfully!');

    console.log(`Querying schema for '${tableName}' table...`);
    const result = await pool.request().query(`
      SELECT
        c.TABLE_SCHEMA           AS [schema],
        c.TABLE_NAME             AS tableName,
        c.COLUMN_NAME            AS columnName,
        c.DATA_TYPE              AS dataType,
        CASE
          WHEN c.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
          WHEN c.CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR)
          WHEN c.NUMERIC_PRECISION IS NOT NULL THEN
            CAST(c.NUMERIC_PRECISION AS VARCHAR) + ',' + CAST(c.NUMERIC_SCALE AS VARCHAR)
          ELSE NULL
        END                      AS maxLength,
        c.IS_NULLABLE            AS isNullable,
        c.COLUMN_DEFAULT         AS defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = '${tableName.replace(/'/g, "''")}'
      ORDER BY c.ORDINAL_POSITION
    `);

    const columns = result.recordset;
    if (columns.length === 0) {
      console.log(`Table '${tableName}' not found or has no columns.`);
      return;
    }

    console.log(`Found ${columns.length} columns for '${tableName}' table.`);

    const output = {
      tableName,
      columns: columns.map(c => ({
        columnName: c.columnName,
        dataType: c.maxLength ? `${c.dataType}(${c.maxLength})` : c.dataType,
        isNullable: c.isNullable === 'YES',
        defaultValue: c.defaultValue
      }))
    };

    // Save inside workspace/ folder within the project root (never outside)
    const projectRoot = path.resolve(__dirname, '../');
    const workspaceDir = path.join(projectRoot, 'workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Derive output filename dynamically from the table name
    const outputPath = path.join(workspaceDir, `${tableName}_schema.json`);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Schema successfully written to ${outputPath}`);
    console.log(`\n--- ${tableName.toUpperCase()} TABLE SCHEMA ---`);
    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    console.error('Error fetching schema:', err);
  }
}

run();
