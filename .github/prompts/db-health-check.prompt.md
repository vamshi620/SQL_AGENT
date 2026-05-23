---
description: Performs a quick health check on the database schema — finds missing indexes,
  nullable PKs, missing audit columns, FK without indexes, and other schema issues.
mode: agent
model: gpt-4o
---

# Database Schema Health Check

Run a complete health check on the database schema.

## Instructions

1. Call `get_db_schema` to fetch the full schema (no table filter — get everything)
2. Apply the `schema-analysis` skill to analyze the results
3. Produce a health report with these sections:

### Schema Inventory
- Total tables, grouped by domain cluster

### 🔴 Critical Issues
- Nullable primary keys
- Tables with no primary key
- Tables with no rows (possibly orphaned)

### 🟠 Major Issues  
- Foreign keys without covering indexes
- Missing `IsDeleted BIT` soft-delete column
- Tables without `CreatedAt` / `UpdatedAt` audit columns

### 🟡 Minor Issues
- `VARCHAR` instead of `NVARCHAR` columns
- `DATETIME` instead of `DATETIME2` columns
- Columns named ambiguously (e.g., `Date`, `Name`, `Status` without prefix)

### ✅ Good Patterns Found
- Well-named tables, proper indexes, good audit columns

### Recommended Actions
- Numbered list of fixes ordered by severity

Format the output as a clean markdown table for each section.
