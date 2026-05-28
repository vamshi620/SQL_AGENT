# MCP-Only Walkthrough

This project is MCP-only.

## Flow
1. Start MCP server from `mcp-server/`
2. Use `get_db_schema` for live schema context
3. Use `run_sql` dry-run first, then real execution
4. Use `run_unit_tests` for DB verification
5. Use `save_csv` and `generate_word_doc` for outputs
6. Use `read_file` / `write_file` / `list_files` for workspace assets

## Notes
- No custom agents
- No prompt/skill/hook files
- All development and orchestration is performed through MCP tool calls
