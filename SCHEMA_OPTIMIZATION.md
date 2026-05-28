# Schema Optimization Guide – Hybrid Approach for Large Databases

## Problem Statement

When working with enterprise SQL Server databases (100+ tables), the original pipeline fetches the **complete database schema** multiple times:
- **Orchestrator Agent**: Full schema fetch (~15,000 tokens for a 250-table DB)
- **Requirements Agent**: Full schema fetch (~15,000 tokens)
- **SQL Implementation Agent**: Full schema fetch (~15,000 tokens)
- **Code Review Agent**: Full schema fetch (~15,000 tokens)

**Total overhead**: ~60,000 tokens wasted on redundant full-schema fetches, plus only ~10-15 tables are actually relevant.

This document describes the **Hybrid Schema Optimization** that reduces this to a single smart fetch + cached reuse.

---

## Solution: Hybrid Optimization (Option 5)

### Three Components

#### 1. **Smart Filtering** – Extract Keywords, Identify Relevant Tables

When you request "I need a loyalty points system":
- Extract keywords: `["loyalty", "points", "system"]`
- Search database for matching tables: `LoyaltyPoints`, `Loyalty`, `Points`, `Rewards`, etc.
- Return only the ~10 relevant tables instead of all 250

**Token savings**: ~90% reduction for the initial fetch (250 → 10 tables)

#### 2. **Schema Caching** – Single Fetch, Multiple Reuses

After the orchestrator fetches schema (smart or full), it:
- Serializes the schema to MEMORY.md in a compact format
- Downstream agents reuse the cached schema with `useCache: true`
- Eliminates 3 redundant full-schema fetches

**Token savings**: ~95% reduction per downstream agent

#### 3. **Database Size Detection** – Auto-Recommend Strategy

`get_db_schema` automatically:
- Detects if DB has >100 tables
- Warns users to consider filtering
- Recommends smart schema fetching

---

## Architecture

### New MCP Tools

#### `get_smart_schema(keywords?, useCache?, cachedSchema?, forceFull?)`

**Hybrid intelligence** – combines all three optimizations.

```typescript
// Downstream agent reusing cache (best case: ~95% token savings)
const result = await getSmartSchema({
  keywords: "loyalty points",
  useCache: true,
  cachedSchema: { /* from MEMORY.md */ }
});
// Result: full schema with zero DB calls

// Standalone agent using smart filtering
const result = await getSmartSchema({
  keywords: "order tracking"
  // Automatically determines table filter based on keywords
});
// Result: only relevant tables fetched

// Force full schema if needed (with warning)
const result = await getSmartSchema({
  forceFull: true
});
```

#### `suggest_relevant_tables(keywords)`

**Lightweight recommendation** – identifies relevant tables without full schema.

```typescript
const result = await suggestRelevantTables("customer loyalty");
// Returns: ["Customers", "Orders", "LoyaltyPoints", ...] + strategy

// Use result to manually filter before calling get_db_schema
```

#### `get_table_names()`

**Table discovery** – returns only names and row counts, no column/index details.

Used as the first phase of two-phase discovery when smart schema unavailable.

---

## MEMORY.md Cache Format

The orchestrator agent initializes this in MEMORY.md:

```markdown
## Schema Cache (for downstream agents to reuse)
⚠️ **IMPORTANT**: Downstream agents MUST use this cached schema instead of fetching their own.

```json
{
  "databaseName": "MyCompanyDB",
  "cacheTimestamp": "2026-05-28T16:40:00.000Z",
  "tableCount": 10,
  "totalRowCount": 250000,
  "tablesSummary": [
    "Orders|dbo|100000",
    "OrderItems|dbo|500000",
    "Customers|dbo|50000",
    "LoyaltyPoints|dbo|100000",
    "...": "..."
  ]
}
```

**Downstream agents use it like this:**

```
get_smart_schema(
  keywords: "from MEMORY.md requirements",
  useCache: true,
  cachedSchema: {
    "databaseName": "MyCompanyDB",
    "cacheTimestamp": "...",
    ...
  }
)
```

---

## Token Savings Analysis

### Scenario: 250-Table Enterprise DB + "Loyalty Points" Feature

#### Without Optimization (Original)
```
Orchestrator:  get_db_schema() → 15,000 tokens
Requirements:  get_db_schema() → 15,000 tokens
SQL Impl:      get_db_schema() → 15,000 tokens
Code Review:   get_db_schema() → 15,000 tokens
────────────────────────────
Total:         4 fetches × 15,000 = 60,000 tokens wasted
```

#### With Hybrid Optimization
```
Orchestrator:  get_smart_schema("loyalty points") → 1,500 tokens (10 tables)
               Store in MEMORY.md cache
Requirements:  get_smart_schema(useCache=true) → 10 tokens (zero DB calls)
SQL Impl:      get_smart_schema(useCache=true) → 10 tokens (zero DB calls)
Code Review:   get_smart_schema(useCache=true) → 10 tokens (zero DB calls)
────────────────────────────
Total:         1 smart fetch + 3 cache reuses = 1,540 tokens
Savings:       60,000 - 1,540 = 58,460 tokens (97% reduction!)
```

---

## Agent Instructions (Updated)

### Orchestrator Agent

```markdown
### 3. Auto-Discover Schema (Hybrid Optimization)

**RECOMMENDED: Call `get_smart_schema` with the feature description** 
to intelligently fetch schema.

get_smart_schema(keywords: "[user's feature description]")

This approach automatically:
- Identifies relevant tables via keyword matching
- For large DBs: Fetches only needed tables (~90% token savings)
- Provides optimization recommendations
- Returns optimized schema for caching in MEMORY.md
```

### Requirements Agent

```markdown
### Step 1 – Auto-Discover Schema (Hybrid Optimization)

**RECOMMENDED: Call `get_smart_schema`** with the user request.

get_smart_schema(keywords: "[user's feature description]")

This hybrid approach automatically:
- Extracts keywords (e.g., "loyalty points" → ["loyalty", "points"])
- For large DBs (>100 tables): Identifies relevant tables
- For normal DBs: Fetches full schema efficiently
```

### SQL Implementation Agent

```markdown
### Step 1 – Auto-Discover Schema (Hybrid Optimization with Caching)

**FIRST: Check MEMORY.md for Schema Cache**

If **Schema Cache** section exists, call:

get_smart_schema(
  keywords: "[from MEMORY.md Requirements]",
  useCache: true,
  cachedSchema: [copy from MEMORY.md]
)

This costs ZERO database calls and saves ~10,000+ tokens!

**Otherwise:** Call `get_smart_schema` normally.
```

### Code Review Agent

```markdown
### Step 2 – Auto-Discover Schema Context (Hybrid with Caching)

**FIRST: Check MEMORY.md for Schema Cache**

If cache exists, call:

get_smart_schema(
  keywords: "[SQL tables referenced]",
  useCache: true,
  cachedSchema: [from MEMORY.md]
)

With cache: Zero DB calls, ~95% token savings
Without cache: Intelligent fetch of only relevant tables
```

### Unit Test Agent

```markdown
### Step 1 – Auto-Discover Schema + SP List (Hybrid with Caching)

**FIRST: Check MEMORY.md for Schema Cache**

If cache exists, call:

get_smart_schema(
  keywords: "[feature name]",
  useCache: true,
  cachedSchema: [from MEMORY.md]
)

Why cache is critical: Unit testing often re-runs multiple times.
Reusing cache saves ~10,000+ tokens per run!
```

---

## Implementation Details

### Smart Table Discovery Algorithm

**File**: `mcp-server/src/tools/schema-optimizer.ts`

#### `extractTableKeywords(text: string): string[]`

Extracts meaningful keywords from natural language:
```
Input:  "I need to add a customer loyalty points system"
Output: ["customer", "loyalty", "points", "system"]
        (after removing stop words)
```

#### `findRelevantTables(schema, keywords): string[]`

Matches keywords against table names using **fuzzy scoring**:
```
Score 3: Exact match        ("order" = "Orders" table)
Score 2: Substring match    ("loyalty" ⊆ "LoyaltyPoints")
Score 2: Plural form match  ("order" = "Orders", "point" = "Points")
Score 1: Column name match  ("customer_id" column contains "customer")
```

Results sorted by score, returns top matches.

#### `determineTableFilter(tableNames, keywords): { tableFilter, strategy }`

Implements the decision logic:
```
if keywords && enough matches (≥5 tables)
  → Use smart filter
else if DB is large (>100 tables)
  → Warn user, suggest filtering
else
  → Fetch full schema (acceptable size)
```

### Schema Caching

**File**: `mcp-server/src/tools/get-smart-schema.ts`

#### `serializeSchemaToCache(schema): CachedSchemaFormat`

Compresses schema for MEMORY.md:
```typescript
{
  databaseName: "MyDB",
  tableCount: 10,
  totalRowCount: 250000,
  tablesSummary: [
    "Orders|dbo|100000",     // compact format: "name|schema|rowcount"
    "Customers|dbo|50000"
  ]
}
```

#### `deserializeSchemaFromCache(cached): DbSchemaResult`

Rebuilds schema object from cache:
```typescript
const schema = {
  databaseName: "MyDB",
  tables: [
    { tableName: "Orders", schema: "dbo", rowCount: 100000, columns: [], indexes: [] },
    ...
  ]
};
```

#### `getSmartSchema(request): GetSmartSchemaResult`

Main function implementing hybrid optimization:
1. **If cache available**: Return immediately (zero calls)
2. **If keywords available**: Use smart filtering
3. **If large DB**: Warn and suggest filtering
4. **Otherwise**: Fetch full schema

---

## Best Practices

### For Orchestrator Agents

1. **Always use `get_smart_schema`** when initializing schema, not `get_db_schema`
2. **Store result in MEMORY.md** under "Schema Cache" section
3. **Include optimization metrics** in pipeline status
   ```markdown
   | | |
   | Schema Fetched | 10 tables (90% reduction) |
   | Estimated Token Savings | ~58,460 tokens vs. full fetch |
   ```

### For Downstream Agents

1. **Always check MEMORY.md first** for existing schema cache
2. **Prioritize `useCache: true`** when cache available
3. **Only fetch fresh schema if** cache doesn't exist or is outdated
4. **Don't re-call `get_db_schema` with NO filter** – use `get_smart_schema` instead

### For Large Databases (>100 Tables)

1. **Extract keywords from requirements** early
2. **Use `suggest_relevant_tables`** for quick validation
3. **Call `get_smart_schema`** with keywords to auto-identify relevant tables
4. **Cache immediately** in MEMORY.md for downstream reuse
5. **Monitor token savings** – should see 50-95% reduction

### For Small Databases (<50 Tables)

1. **Full schema fetch is fine** – keyword filtering overhead > benefit
2. **Still use `get_smart_schema`** for consistency (it auto-detects small DBs)
3. **Caching still beneficial** if pipeline runs multiple stages

---

## Fallback Strategies

### If `get_smart_schema` is Unavailable

**Two-phase approach:**

1. **Phase 1**: Call `get_table_names` to list all tables
2. **Phase 2**: Extract keywords, identify relevant tables manually
3. **Phase 3**: Call `get_db_schema` with filtered list

```
get_table_names()
  → [Orders, Customers, LoyaltyPoints, Products, ...]
  → identify relevant: [Orders, LoyaltyPoints]
  → get_db_schema(tables: ["Orders", "LoyaltyPoints"])
```

### If Caching is Not Available

**Sequential fetching with context passing:**

1. Orchestrator fetches schema with `get_smart_schema` (keywords)
2. Orchestrator passes schema as JSON in MEMORY.md
3. Downstream agents manually build `cachedSchema` object
4. Call `get_smart_schema` with `useCache: true`

---

## Monitoring & Metrics

### Token Usage Tracking

Add to MEMORY.md after each schema fetch:

```markdown
## Optimization Metrics

| Metric | Value | Note |
|--------|-------|------|
| Database Total Tables | 250 | |
| Tables Fetched | 10 | Smart filter by keywords |
| Fetch Strategy | get_smart_schema | Hybrid with caching |
| Estimated Tokens (fetch) | 1,500 | Original: 15,000 |
| Cache Reuse Efficiency | 4 agents × 10 tokens | Original: 4 × 15,000 |
| **Total Savings** | **58,460 tokens** | 97% reduction |
```

### Performance Indicators

Expected performance by database size:

| DB Size | Strategy | Tokens (1st Fetch) | Tokens (Reuse) | Total Pipeline |
|---------|----------|-------------------|----------------|----------------|
| <50 tables | Full fetch | 5,000 | 10/agent | ~5,040 |
| 50-100 tables | Smart filter or full | 5,000-7,500 | 10/agent | ~5,040-7,540 |
| 100-500 tables | Smart filter | 1,500-3,000 | 10/agent | ~1,540-3,040 |
| 500+ tables | Smart filter | 2,000-4,000 | 10/agent | ~2,040-4,040 |

---

## Example: Loyalty Points Feature on 250-Table DB

### Step 1: Orchestrator Initializes

```
User Input: "I need to add a customer loyalty points system"

Orchestrator calls:
  get_smart_schema(
    keywords: "I need to add a customer loyalty points system"
  )

Result:
  {
    "strategy": "Smart filter: Found 8 relevant tables from keywords",
    "tablesIncluded": 8,
    "tokenSavingTip": "Fetched 8/250 tables (~95% token reduction)",
    "recommendation": "Cache this schema in MEMORY.md for 3 downstream agents to save ~30,000 tokens",
    "schema": { /* 8 tables with full details */ }
  }

Orchestrator stores in MEMORY.md:
  ## Schema Cache
  {
    "databaseName": "CompanyDB",
    "tableCount": 8,
    "tablesSummary": [
      "Customers|dbo|50000",
      "Orders|dbo|100000",
      ...
    ]
  }
```

### Step 2: Requirements Agent Reuses Cache

```
Requirements Agent reads MEMORY.md, finds Schema Cache

Calls:
  get_smart_schema(
    keywords: "loyalty points system",
    useCache: true,
    cachedSchema: { /* from MEMORY.md */ }
  )

Result:
  {
    "strategy": "Cache Hit",
    "tablesIncluded": 8,
    "recommendation": "Using cached schema. No database calls made."
  }

Token cost: ~10 tokens (vs. 15,000 for full fetch)
```

### Step 3: SQL Implementation Agent Reuses Cache

Same as Requirements Agent – reuses cached schema.

### Step 4: Code Review Agent Reuses Cache

Same as Requirements Agent – reuses cached schema.

### Step 5: Unit Test Agent Reuses Cache

Same as Requirements Agent – reuses cached schema.

### Total Token Savings

```
Full schema fetch (250 tables):         ~15,000 tokens
Smart filter (8 tables):                ~1,500 tokens (saving: 13,500)
Requirements agent cache reuse:         ~10 tokens  (saving: 15,000)
SQL agent cache reuse:                  ~10 tokens  (saving: 15,000)
Code review agent cache reuse:          ~10 tokens  (saving: 15,000)
Unit test agent cache reuse:            ~10 tokens  (saving: 15,000)
─────────────────────────────────────────────────
TOTAL SAVINGS: ~73,500 tokens (98% reduction!)
```

---

## References

- **Schema Optimizer Module**: `mcp-server/src/tools/schema-optimizer.ts`
- **Smart Schema Tool**: `mcp-server/src/tools/get-smart-schema.ts`
- **MCP Server**: `mcp-server/src/index.ts` (tools registered)
- **Agent Instructions**: `.github/agents/*.agent.md`

---

## Future Enhancements

- [ ] Machine learning-based keyword matching (currently rule-based)
- [ ] Schema caching with TTL (e.g., invalidate after 1 hour)
- [ ] Multi-database support (switch between databases mid-pipeline)
- [ ] Query-time schema discovery (analyze SQL to extract table references)
- [ ] Metrics dashboard (track token savings across multiple runs)

