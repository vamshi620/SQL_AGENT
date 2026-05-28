/**
 * Schema Optimizer Utilities
 * 
 * Provides smart schema discovery and caching to reduce token usage on large databases.
 * - Keyword extraction: Identifies relevant tables from natural language
 * - Schema caching: Serializes schema for MEMORY.md
 * - Size detection: Warns about large databases
 * - Fallback strategy: Uses full schema if insufficient matches found
 */

import { DbSchemaResult, TableSchema, TableNameInfo } from './db-schema.js';

export interface SmartSchemaOptions {
  keywords?: string[];
  maxTablesForFullFetch?: number;
  minRelevantTables?: number;
}

export interface CachedSchemaFormat {
  databaseName: string;
  cacheTimestamp: string;
  tableCount: number;
  totalRowCount: number;
  // Compressed format: "tableName|schema|rowCount"
  tablesSummary: string[];
  // Full schema stored as JSON base64 (optional for large schemas)
  fullSchemaBase64?: string;
}

/**
 * Extracts potential table names from natural language keywords.
 * Uses fuzzy matching to handle variations like "Order", "Orders", "OrderHeader".
 * 
 * @example
 * extractTableKeywords("I need to add a customer loyalty points system")
 * // Returns: ["customer", "loyalty", "points", "system"]
 */
export function extractTableKeywords(text: string): string[] {
  if (!text) return [];
  
  // Convert to lowercase and split by whitespace/punctuation
  const words = text
    .toLowerCase()
    .split(/[\s\-_.,;:!?()\[\]{}'"]+/)
    .filter(w => w.length > 2); // Filter out very short words
  
  // Remove common SQL stop words
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'will',
    'need', 'want', 'have', 'make', 'create', 'add', 'get', 'set', 'use',
    'system', 'data', 'record', 'field', 'column', 'table', 'database',
  ]);
  
  return [...new Set(words.filter(w => !stopWords.has(w)))];
}

/**
 * Finds relevant tables by matching keywords against table names and column names.
 * Returns table names that match (fuzzy matching with case-insensitive substring match).
 * 
 * @example
 * const schema = { tables: [{ tableName: 'Orders' }, { tableName: 'Customers' }, ...] };
 * const keywords = ['order', 'customer'];
 * const relevant = findRelevantTables(schema, keywords);
 * // Returns: ['Orders', 'Customers', ...] based on best matches
 */
export function findRelevantTables(
  schema: DbSchemaResult | { tables: TableSchema[] },
  keywords: string[]
): string[] {
  if (!keywords || keywords.length === 0) return [];
  
  const tableMap = new Map<string, number>(); // tableName -> score
  
  for (const table of schema.tables) {
    let score = 0;
    
    // Score based on table name matches
    const tableLower = table.tableName.toLowerCase();
    for (const keyword of keywords) {
      // Exact match = 3 points
      if (tableLower === keyword) score += 3;
      // Substring match = 2 points
      else if (tableLower.includes(keyword)) score += 2;
      // Keyword in plural form (e.g., "order" matches "Orders")
      else if (tableLower === keyword + 's' || tableLower === keyword + 'es') score += 2;
    }
    
    // Score based on column name matches
    if (score > 0) {
      for (const column of table.columns || []) {
        const colLower = column.columnName.toLowerCase();
        for (const keyword of keywords) {
          if (colLower.includes(keyword)) score += 1;
        }
      }
    }
    
    if (score > 0) {
      tableMap.set(table.tableName, score);
    }
  }
  
  // Sort by score descending and return table names
  return Array.from(tableMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

/**
 * Implements hybrid schema fetching strategy:
 * 1. If keywords provided: Use smart filtering
 * 2. If database is large (>100 tables) and no keywords: Suggest filtering
 * 3. Otherwise: Fetch full schema
 * 
 * Returns list of table names to fetch (or empty array for full fetch)
 */
export function determineTableFilter(
  tableNames: TableNameInfo[],
  keywords?: string[],
  options?: SmartSchemaOptions
): { tableFilter: string[] | undefined; strategy: string } {
  const maxTables = options?.maxTablesForFullFetch ?? 100;
  const minTables = options?.minRelevantTables ?? 5;
  const totalTables = tableNames.length;
  
  // Strategy 1: Keywords provided → Use smart filtering
  if (keywords && keywords.length > 0) {
    // Create a simple schema object for matching
    const simpleSchema = {
      tables: tableNames.map(t => ({
        tableName: t.tableName,
        schema: t.schema,
        columns: [],
        indexes: [],
        rowCount: t.rowCount,
      })),
    };
    
    const relevant = findRelevantTables(simpleSchema, keywords);
    
    if (relevant.length >= minTables) {
      return {
        tableFilter: relevant,
        strategy: `Smart filter: Found ${relevant.length} relevant tables from keywords`,
      };
    } else if (relevant.length > 0) {
      // Some matches but not enough; include them plus fall back to full
      return {
        tableFilter: undefined,
        strategy: `Smart filter found only ${relevant.length} tables (${minTables} minimum). Falling back to full schema.`,
      };
    }
  }
  
  // Strategy 2: Large database without keywords → Warn and suggest
  if (totalTables > maxTables) {
    return {
      tableFilter: undefined,
      strategy: `⚠️ Large database: ${totalTables} tables detected. Consider using keywords to filter.`,
    };
  }
  
  // Strategy 3: Normal database → Full fetch is reasonable
  return {
    tableFilter: undefined,
    strategy: `Full schema: ${totalTables} tables (acceptable size)`,
  };
}

/**
 * Serializes schema to MEMORY.md cache format.
 * Stores compressed table metadata for downstream agents to reuse.
 * 
 * @example
 * const cached = serializeSchemaToCache(schema);
 * // Returns:
 * // {
 * //   databaseName: 'MyDB',
 * //   tableCount: 25,
 * //   tablesSummary: ['Orders|dbo|10000', 'Customers|dbo|5000', ...]
 * // }
 */
export function serializeSchemaToCache(schema: DbSchemaResult): CachedSchemaFormat {
  const tablesSummary = schema.tables.map(
    t => `${t.tableName}|${t.schema}|${t.rowCount ?? 0}`
  );
  
  const totalRowCount = schema.tables.reduce(
    (sum, t) => sum + (t.rowCount ?? 0),
    0
  );
  
  return {
    databaseName: schema.databaseName,
    cacheTimestamp: schema.fetchedAt,
    tableCount: schema.tables.length,
    totalRowCount,
    tablesSummary,
  };
}

/**
 * Deserializes cached schema from MEMORY.md format.
 * Recreates schema structure for agent use.
 */
export function deserializeSchemaFromCache(cached: CachedSchemaFormat): DbSchemaResult {
  const tables = cached.tablesSummary.map(summary => {
    const [tableName, schema, rowCountStr] = summary.split('|');
    return {
      tableName,
      schema,
      columns: [],
      indexes: [],
      rowCount: parseInt(rowCountStr, 10) || null,
    };
  });
  
  return {
    databaseName: cached.databaseName,
    tables,
    fetchedAt: cached.cacheTimestamp,
  };
}

/**
 * Formats schema info for display in MEMORY.md
 */
export function formatSchemaCacheMarkdown(cached: CachedSchemaFormat): string {
  return `
## Schema Cache
- **Database**: ${cached.databaseName}
- **Total Tables**: ${cached.tableCount}
- **Total Rows**: ${cached.totalRowCount.toLocaleString()}
- **Cached At**: ${cached.cacheTimestamp}

### Tables Summary
\`\`\`
${cached.tablesSummary.slice(0, 20).join('\n')}
${cached.tablesSummary.length > 20 ? `... and ${cached.tablesSummary.length - 20} more tables\n` : ''}
\`\`\`
`;
}
