# GitHub Copilot – MCP-Only Workspace Instructions

## Scope
This workspace is MCP-only. Use MCP tools only.

## End-to-End Flow (MCP Tools Only)
1. `get_db_schema` → inspect live schema
2. `run_sql` with `dryRun: true` → validate changes
3. `run_sql` with `dryRun: false` → execute approved SQL
4. `generate_word_doc` → create requirements/review/test reports when needed
5. `run_unit_tests` → execute test cases and collect snapshots
6. `save_csv` → persist tabular test artifacts
7. `read_file`, `write_file`, `list_files` → manage workspace files
8. `list_mcp_context` → inspect MCP-native agents/skills/prompts/hooks context
9. `run_mcp_agent` → execute agent workflows from MCP

## SQL Rules
- Use SQL Server T-SQL only
- Prefer `NVARCHAR`, `DATETIME2(7)`, `DECIMAL(18,4)`
- Use `SET NOCOUNT ON; SET XACT_ABORT ON;` in stored procedures
- Wrap multi-statement DML in TRY/CATCH + transaction

## Safety Rules
- Always run a dry-run before non-dry-run SQL execution
- Never run destructive SQL (`DROP`, `TRUNCATE`, mass `DELETE`) without explicit user approval
- Return output file paths after document generation

## MCP-native Agents
- `e2e-orchestrator`
- `requirements-agent`
- `sql-impl-agent`
- `code-review-agent`
- `unit-test-agent`

Use `run_mcp_agent` with one of these agent names and a payload.
