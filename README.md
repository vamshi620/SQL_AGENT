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
- `list_mcp_context`
- `run_mcp_agent`

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

## MCP-native agent calls from VS Code
Use `run_mcp_agent` to invoke agent workflows directly from MCP.

### Supported agent names
- `e2e-orchestrator`
- `requirements-agent`
- `sql-impl-agent`
- `code-review-agent`
- `unit-test-agent`

### Discover context
Call `list_mcp_context` to get built-in agent, skill, prompt, and hook mappings.

### Example call
```json
{
  "agent": "requirements-agent",
  "payload": {
    "featureRequest": "Add loyalty points support for customer orders",
    "sessionId": "session-001"
  }
}
```
