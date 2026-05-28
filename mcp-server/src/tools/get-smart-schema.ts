/**
 * Smart Schema Fetching Tool
 * 
 * Combines keyword extraction, schema caching, and size detection.
 * - For large DBs: Suggests relevant tables based on keywords
 * - For normal DBs: Fetches full schema efficiently
 * - Supports reusing cached schema from MEMORY.md
 */

import { getDbSchema, getTableNames } from './db-schema.js';
import {
  extractTableKeywords,
  determineTableFilter,
  findRelevantTables,
  serializeSchemaToCache,
  deserializeSchemaFromCache,
  CachedSchemaFormat,
} from './schema-optimizer.js';

export interface GetSmartSchemaRequest {
  /** Natural language keywords or feature description */
  keywords?: string;
  /** Whether to use cached schema if available (from MEMORY.md) */
  useCache?: boolean;
  /** Cached schema from MEMORY.md (if available) */
  cachedSchema?: CachedSchemaFormat;
  /** Force full schema fetch even if not recommended */
  forceFull?: boolean;
}

export interface GetSmartSchemaResult {
  schema: any; // Full DbSchemaResult
  strategy: string;
  tokenSavingTip?: string;
  tablesIncluded: number;
  recommendation: string;
}

/**
 * Smart schema fetching that minimizes token usage on large databases.
 * 
 * Hybrid approach:
 * 1. If useCache=true and cachedSchema provided: Return cached (zero tokens)
 * 2. If keywords provided: Try smart filtering first
 * 3. If DB is large (>100 tables): Warn and suggest filtering
 * 4. Otherwise: Fetch full schema
 */
export async function getSmartSchema(
  request: GetSmartSchemaRequest
): Promise<GetSmartSchemaResult> {
  // Strategy 1: Use cached schema if requested and available
  if (request.useCache && request.cachedSchema) {
    const schema = deserializeSchemaFromCache(request.cachedSchema);
    return {
      schema,
      strategy: 'Cache Hit',
      tablesIncluded: schema.tables.length,
      recommendation: `Using cached schema (${schema.tables.length} tables). No database calls made.`,
    };
  }

  // Get lightweight table list first
  const tableNames = await getTableNames();
  
  // Strategy 2: Extract keywords and try smart filtering
  let tableFilter: string[] | undefined;
  let strategy = '';
  
  if (request.keywords && !request.forceFull) {
    const keywords = extractTableKeywords(request.keywords);
    const decision = determineTableFilter(tableNames.tables, keywords, {
      maxTablesForFullFetch: 100,
      minRelevantTables: 5,
    });
    
    tableFilter = decision.tableFilter;
    strategy = decision.strategy;
  } else if (tableNames.totalTableCount > 100 && !request.forceFull) {
    // Strategy 3: Warn about large database
    strategy = `⚠️ Large database detected (${tableNames.totalTableCount} tables). Consider using keywords to optimize.`;
  } else if (request.forceFull) {
    strategy = `Force full schema fetch (${tableNames.totalTableCount} tables)`;
  } else {
    strategy = `Full schema fetch (${tableNames.totalTableCount} tables at acceptable size)`;
  }

  // Fetch the schema with determined filter
  const schema = await getDbSchema(tableFilter);

  // Calculate token savings
  const fullTableCount = tableNames.totalTableCount;
  const fetchedTableCount = schema.tables.length;
  const avgColumnsPerTable = 15; // Typical estimate
  const avgIndexesPerTable = 3;
  
  let tokenSavingTip: string | undefined;
  if (fetchedTableCount < fullTableCount) {
    const tablesSkipped = fullTableCount - fetchedTableCount;
    const estimatedTokensSaved = tablesSkipped * (avgColumnsPerTable + avgIndexesPerTable) * 10;
    tokenSavingTip = `Token optimization: Fetched ${fetchedTableCount}/${fullTableCount} tables. Estimated savings: ~${estimatedTokensSaved} tokens (${Math.round((tablesSkipped / fullTableCount) * 100)}% reduction).`;
  }

  return {
    schema,
    strategy,
    tokenSavingTip,
    tablesIncluded: schema.tables.length,
    recommendation:
      tableFilter && tableFilter.length > 0
        ? `Recommended: Cache this schema in MEMORY.md for downstream agents to reuse and save additional ${(fetchedTableCount * 150).toLocaleString()} tokens.`
        : `Database size is normal. Full schema cached is efficient.`,
  };
}

/**
 * Helper: Suggests relevant tables based on keywords without fetching full schema.
 * Use this in agents to identify which tables to include in a filtered fetch.
 */
export async function suggestRelevantTables(keywords: string): Promise<{
  suggestions: string[];
  count: number;
  strategy: string;
}> {
  const tableNames = await getTableNames();
  const extractedKeywords = extractTableKeywords(keywords);
  
  // Create simple schema for matching
  const simpleSchema = {
    tables: tableNames.tables.map(t => ({
      tableName: t.tableName,
      schema: t.schema,
      columns: [],
      indexes: [],
      rowCount: t.rowCount,
    })),
  };
  
  const suggestions = findRelevantTables(simpleSchema, extractedKeywords);
  
  return {
    suggestions,
    count: suggestions.length,
    strategy: suggestions.length > 0
      ? `Found ${suggestions.length} relevant tables matching: ${extractedKeywords.join(', ')}`
      : `No tables matched keywords: ${extractedKeywords.join(', ')}. Consider using full schema or different keywords.`,
  };
}
