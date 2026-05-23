# GitHub Copilot – Global Workspace Instructions
# Applied automatically to ALL agents in this workspace

## Project Context
This is an **E2E SQL Server Development** workspace using GitHub Copilot custom agents.
The development workflow is: Requirements → SQL Implementation → Code Review → Unit Testing.

## Always-On Rules (Apply to Every Response)

### Database
- Target database: **SQL Server** (T-SQL only — never use MySQL or PostgreSQL syntax)
- Always fetch live schema with `get_db_schema` before generating any SQL
- Never assume column names, types, or constraints — always verify against live schema

### SQL Standards
- Use `NVARCHAR` (not `VARCHAR`), `DATETIME2(7)` (not `DATETIME`), `DECIMAL(18,4)` (not `MONEY`)
- All stored procedures: `SET NOCOUNT ON; SET XACT_ABORT ON;` at the top
- All DML in stored procedures: wrapped in `BEGIN TRY / BEGIN TRANSACTION / COMMIT / END TRY / BEGIN CATCH / ROLLBACK / THROW / END CATCH`
- Naming: tables PascalCase plural, procs `usp_<Entity>_<Action>`, indexes `IX_<Table>_<Col>`

### Safety
- NEVER execute SQL without dry-run first (`run_sql` with `dryRun: true`)
- NEVER drop tables or truncate without explicit user instruction
- ALWAYS tell the user the file path after generating any Word document

### Output Documents
- Save all Word docs to the `output/` folder
- Filename format: `<type>-<feature>-<YYYY-MM-DD>.docx`
- Always confirm document was saved: "✅ Document saved to: output/filename.docx"

### Agent Handoffs
- At end of each agent task, produce a **Handoff Summary** using the `agent-handoff` skill format
- This summary helps the user know exactly what to paste to the next agent

## Slash Command Shortcuts

Users can type these shortcuts:
- `/sql-standards` → loads the T-SQL coding standards skill
- `/schema-analysis` → loads the schema analysis skill
- `/test-patterns` → loads the SQL test patterns skill
- `/docx-template` → loads the document writer skill
- `/handoff` → generates a handoff summary for the next agent
