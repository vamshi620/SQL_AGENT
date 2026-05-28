# SQL_AGENT (MCP-Only)

This repository now uses a **single MCP server workflow** for end-to-end SQL Server development.

## What changed
- Removed custom agents
- Removed prompt shortcuts
- Removed reusable skill files
- Removed hook files
- Kept only MCP-server-driven development

## MCP Server
Location: `/tmp/workspace/vamshi620/SQL_AGENT/mcp-server`

### Available MCP tools
- `get_db_schema`
- `run_sql`
- `generate_word_doc`
- `run_unit_tests`
- `save_csv`
- `read_file`
- `write_file`
- `list_files`

## Quick start
```bash
cd /tmp/workspace/vamshi620/SQL_AGENT/mcp-server
npm install --ignore-scripts
npm run build
```

## End-to-end usage (MCP only)
1. Analyze schema with `get_db_schema`
2. Prepare SQL changes and validate with `run_sql` (`dryRun: true`)
3. Execute approved SQL with `run_sql` (`dryRun: false`)
4. Run functional tests with `run_unit_tests`
5. Save evidence with `save_csv`
6. Generate deliverables with `generate_word_doc`
