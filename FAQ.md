# Frequently Asked Questions (FAQ) — SQL Server E2E Agents

## General Questions

### Q1: What are these agents and why do I need them?

**A:** These are **5 GitHub Copilot custom agents** that automate the entire SQL Server development lifecycle—from capturing requirements to deploying code and running tests. Instead of manually writing requirements docs, SQL, code reviews, and tests, the agents handle each step, producing professional Word documents and validated SQL scripts.

- **Requirements Agent**: Captures what you need to build
- **SQL Implementation Agent**: Generates production-ready T-SQL
- **Code Review Agent**: Validates code for security and performance
- **Unit Testing Agent**: Deploys and runs tests automatically
- **Orchestrator Agent**: Coordinates all four agents in sequence

---

### Q2: How do I invoke an agent?

**A:** Use the `@` mention syntax in Copilot Chat:
- `@e2e-orchestrator I need to add a new feature...`
- `@requirements-agent Describe this feature...`
- `@sql-impl-agent Write the SQL for this...`
- `@code-review-agent Review this SQL file...`
- `@unit-test-agent Run tests for this feature...`

You can also use slash commands (if configured):
- `/new-pipeline` — Starts the orchestrator
- `/run-full-pipeline` — Runs all agents in sequence
- `/db-health-check` — Analyzes your current schema
- `/generate-unit-tests` — Generates test suite for a stored proc

---

### Q3: What's the difference between using the orchestrator vs. individual agents?

**A:** 
- **Orchestrator (`@e2e-orchestrator`)**: The recommended starting point. It coordinates all 4 agents, maintains pipeline state in `MEMORY.md`, and provides a guided workflow with handoff buttons.
- **Individual agents**: Use these when you want to repeat a single step (e.g., re-run code review after fixing issues, or generate new tests without re-running SQL implementation).

---

### Q4: Can I use the agents without SQL Server?

**A:** No. The agents require a live SQL Server instance (local or remote) because they:
- Fetch your current schema with `get_db_schema`
- Execute dry-run SQL to validate before deployment
- Run unit tests directly on your database

You must configure the `.env` file with valid SQL Server connection details (see **Setup Questions** below).

---

## Setup Questions

### Q5: How do I configure the database connection?

**A:** 
1. Copy the template: `copy .env.example .env`
2. Edit `.env` with your SQL Server details:
   ```env
   DB_SERVER=localhost        # or remote IP
   DB_DATABASE=YourDatabase
   DB_USER=sa                 # or your user
   DB_PASSWORD=YourPassword!
   DB_TRUST_SERVER_CERTIFICATE=true  # for dev/test; use false + cert in prod
   ```
3. Save the file (do NOT commit `.env` to Git—it's in `.gitignore`)

---

### Q6: How do I build and register the MCP server?

**A:**
```bash
cd mcp-server
npm install --ignore-scripts   # Install dependencies
npm run build                  # Build TypeScript → dist/
```

VS Code will **automatically detect** `.vscode/mcp.json` and register the MCP server with Copilot. Open Copilot Chat → Tools icon → you should see `get_db_schema`, `run_sql`, etc.

**Troubleshooting**: If tools don't appear after build, try restarting VS Code.

---

### Q7: Do I need SQL Server Management Studio (SSMS) installed?

**A:** No. The agents communicate with SQL Server via the `mssql` npm package (connection string). You don't need SSMS, though it can be helpful for manual inspection. The agents handle all deployments and testing directly.

---

### Q8: What Node.js version do I need?

**A:** Node.js **18+** is required. Check your version:
```bash
node --version   # Should be v18.0.0 or higher
```

If you need to upgrade, download from [nodejs.org](https://nodejs.org).

---

### Q9: What if I get an "MCP Server not found" error?

**A:** This means the MCP server either:
1. Wasn't built yet → Run `npm run build` in `mcp-server/`
2. Is not registered with VS Code → Check `.vscode/mcp.json` exists and restart VS Code
3. Has a configuration error → Check `.env` is correctly formatted
4. TypeScript compilation failed → Check the `npm run build` output for errors

---

## Usage Questions

### Q10: What's the typical workflow? (Step-by-step)

**A:** The recommended end-to-end flow:

1. **Start**: Type `@e2e-orchestrator I need to build a customer loyalty points system.`
2. **Orchestrator responds** with pipeline status + 4 handoff buttons
3. **Step 1 - Requirements**: Click the button → `@requirements-agent` analyzes + generates `requirements-*.docx`
4. **Step 2 - SQL Implementation**: Click the button → `@sql-impl-agent` generates T-SQL, runs dry-run, deploys
5. **Step 3 - Code Review**: Click the button → `@code-review-agent` reviews SQL + generates `code-review-*.docx`
6. **Step 4 - Unit Testing**: Click the button → `@unit-test-agent` deploys + runs tests + generates `test-report-*.docx`
7. **Done**: Orchestrator generates final `pipeline-summary-*.docx`

All output documents are saved to `output/`.

---

### Q11: Can I skip steps in the pipeline?

**A:** Yes. You can invoke individual agents at any time:
- Jump directly to code review: `@code-review-agent Please review this SQL...`
- Re-run tests: `@unit-test-agent Run tests for the LoyaltyPoints procedures...`

However, the **orchestrator maintains context** in `MEMORY.md`. If you skip steps, you may need to manually update context or re-run the orchestrator.

---

### Q12: What does "dry-run" mean? When should I use it?

**A:** Dry-run (`dryRun: true`) **previews SQL without executing** it. The agents:
1. Always run `dry-run` first to validate SQL syntax
2. Show you the predicted results (what would happen)
3. Ask for confirmation before running with `dryRun: false` (actual execution)

**Best practice**: Always let agents run dry-run first. Review the output before confirming real execution.

---

### Q13: What if an agent fails midway through the pipeline?

**A:**
1. Check the error message—usually tells you what went wrong (e.g., "Table already exists")
2. Fix the issue (e.g., drop the conflicting table, fix permissions)
3. Run the agent again OR jump to the next step

The **`MEMORY.md` file** tracks pipeline state, so you can always see where you left off.

---

### Q14: Can I run multiple features in parallel (different agents, different features)?

**A:** Not reliably. Each agent uses the same `MEMORY.md` file and database connection. Running two orchestrator pipelines simultaneously could corrupt state.

**Recommendation**: Complete one feature (all 4 steps) before starting another, or use separate VS Code windows with separate `MEMORY.md` files.

---

### Q15: How do I stop an agent mid-execution?

**A:** In Copilot Chat, click the **Stop** button (red square icon) to cancel the current agent. However, any **SQL already executed** (non-dry-run) will persist in your database. Use database transactions or manual cleanup if needed.

---

## MCP Tools Questions

### Q16: What MCP tools are available, and what do they do?

**A:** The MCP server exposes **7 tools** to all agents:

| Tool | Purpose | Example |
|---|---|---|
| `get_db_schema` | Fetch your database schema (tables, columns, constraints, indexes) | `get_db_schema(tables: ["Customers", "Orders"])` |
| `run_sql` | Execute SQL scripts with optional dry-run | `run_sql(sqlScript, dryRun: true)` |
| `generate_word_doc` | Create formatted Word documents (.docx) | `generate_word_doc(filename, title, sections)` |
| `run_unit_tests` | Deploy SQL and run tSQLt or custom test procedures | `run_unit_tests(deploymentSql, testProcedures)` |
| `read_file` | Read files from workspace (e.g., MEMORY.md, SQL scripts) | `read_file("MEMORY.md")` |
| `write_file` | Write or append to workspace files | `write_file("MEMORY.md", content, append: true)` |
| `list_files` | List files in a directory | `list_files("sql/", pattern: "*.sql")` |

---

### Q17: Can I call MCP tools directly or only through agents?

**A:** Agents call the tools. You can't invoke them directly from Copilot Chat. However, if you open the **Tools panel** in Copilot, you'll see the available tools and their parameter schemas.

---

### Q18: What does `get_db_schema` return exactly?

**A:** `get_db_schema` returns a comprehensive JSON object with:
- **Tables**: name, columns (name, data type, nullable, default, identity)
- **Primary Keys**: table, columns
- **Foreign Keys**: table, referenced table, constraint rules
- **Indexes**: table, columns, unique/clustered flags
- **Views**: names, column definitions
- **Stored Procedures**: names, parameters, return types

You can optionally filter by table names: `get_db_schema(tables: ["Customers", "Orders"])`

---

### Q19: What parameters does `run_sql` accept?

**A:**
- `sqlScript` (required): The T-SQL code to execute (string)
- `dryRun` (optional, default: false): If `true`, wraps in a transaction and rolls back; doesn't persist changes
- The tool automatically **batches on GO** statements

**Example:**
```
run_sql(
  sqlScript: "CREATE TABLE Customers (ID INT PRIMARY KEY, Name NVARCHAR(100))",
  dryRun: true  // Preview only, will rollback
)
```

---

### Q20: How are Word documents structured by `generate_word_doc`?

**A:** The agent specifies:
- `filename`: Base name (date/time added automatically)
- `title`: Document title
- `sections[]`: Array of section objects with:
  - `heading`: Section title
  - `content`: Text content (supports Markdown, converted to formatted text)
  - `table` (optional): Markdown-style table data

Example section:
```json
{
  "heading": "Requirements",
  "content": "The customer needs a loyalty points system..."
}
```

Output: `output/requirements-loyalty-points-2026-05-28.docx`

---

## Output & Documentation Questions

### Q21: Where are output files saved?

**A:** All generated documents are saved to the `output/` directory at the repository root:

```
output/
  requirements-loyalty-points-2026-05-28.docx
  code-review-loyalty-points-2026-05-28.docx
  test-report-loyalty-points-2026-05-28.docx
  pipeline-summary-loyalty-points-2026-05-28.docx
```

Files are **not version-controlled** (in `.gitignore`). You can download them from your local `output/` folder or VS Code explorer.

---

### Q22: Can I customize the output document format?

**A:** The `docx-document-writer` skill defines standard section structures per document type (Requirements, Code Review, Test Report). Agents use these templates for consistency.

To customize:
1. Edit the relevant skill file in `.github/skills/docx-document-writer/SKILL.md`
2. Update the agent prompt to use your custom section structure
3. The agents will follow the new template on the next run

---

### Q23: What is `MEMORY.md` and how is it used?

**A:** `MEMORY.md` is a **workspace state file** maintained by the orchestrator agent:
- Records feature name, database context, requirements summary
- Tracks which pipeline steps are done (✅ complete / ⏳ in progress / ❌ failed)
- Stores references to generated SQL files and document paths
- Acts as a "handoff document" between pipeline stages

**Location**: Repository root (`MEMORY.md`)
**Access**: Read/write via `read_file` and `write_file` tools
**Note**: Create a fresh `MEMORY.md` for each new feature to avoid conflicts.

---

### Q24: Can I download the generated Word documents?

**A:** Yes! After generation:
1. Open VS Code's **Explorer** (left sidebar)
2. Navigate to `output/` folder
3. Right-click the `.docx` file → **Reveal in File Explorer**
4. Download or open in Microsoft Word

---

## Unit Testing Questions

### Q25: What unit testing frameworks do the agents support?

**A:** The agents **auto-detect** which framework to use:

| Framework | Detection | How Tests Run |
|---|---|---|
| **tSQLt** | If `tSQLt` schema exists in DB | `EXEC tSQLt.RunAll` |
| **Custom** | No tSQLt → Fallback | All procs matching `usp_Test_*` pattern |

---

### Q26: What's the custom test procedure convention?

**A:** If you don't use tSQLt, create test procedures following this pattern:

```sql
CREATE OR ALTER PROCEDURE [dbo].[usp_Test_LoyaltyPoints_AddPoints]
AS
BEGIN
    -- Setup
    DECLARE @CustomerID INT = -1
    
    -- Execute
    EXEC usp_AddPoints @CustomerID = @CustomerID, @Points = 100
    
    -- Assert: Return Status, ErrorMessage, Expected, Actual
    SELECT 
        'PASS' AS Status,
        NULL AS ErrorMessage,
        '100' AS Expected,
        '100' AS Actual
    
    UNION ALL
    
    -- Edge case test
    SELECT 'PASS', NULL, 'Not Null', CAST(Points AS NVARCHAR(MAX))
    FROM LoyaltyPoints WHERE CustomerID = @CustomerID
END
```

**Return columns** (required):
- `Status`: 'PASS' or 'FAIL'
- `ErrorMessage`: NULL for pass, error description for fail
- `Expected`: What should happen
- `Actual`: What actually happened

---

### Q27: Do tests need to clean up their data?

**A:** **No**. The `unit-test-agent` uses **negative IDs** (e.g., -1, -2) for test data to avoid conflicts with production data. Tests insert data that **persists** in your database for review.

**Why?** You can manually inspect test results in the database afterward. If you want automatic cleanup:
1. Wrap test logic in a **transaction** and **rollback** at the end
2. Or, manually delete test rows (e.g., `DELETE FROM Customers WHERE ID < 0`)

---

### Q28: Can I run specific tests (not all)?

**A:** The `run_unit_tests` tool accepts a **list of test procedure names**:

```
run_unit_tests(
  deploymentSql: "...",
  testProcedures: [
    "usp_Test_LoyaltyPoints_AddPoints",
    "usp_Test_LoyaltyPoints_RedeemPoints"
  ]
)
```

Specify only the procedures you want to run. If you omit this parameter, all tests (tSQLt.RunAll or all `usp_Test_*` procs) run.

---

## Security & Best Practices

### Q29: How do agents prevent SQL injection?

**A:** All database calls use **parameterized queries** (bound parameters). SQL scripts are passed through the `run_sql` tool, which:
1. Validates the script syntax
2. Executes via parameterized calls to the SQL Server driver
3. Never concatenates user input into the SQL command string

---

### Q30: Can agents execute DROP TABLE or DELETE without WHERE?

**A:** **No**. A **security hook** (`security-gate.json`) blocks dangerous operations:
- `DROP TABLE` (no conditions needed)
- `TRUNCATE TABLE` (no conditions needed)
- `DELETE` without a `WHERE` clause

**Exception**: These operations are allowed if `dryRun: true` (preview mode).

**Why?** To prevent accidental data loss. If you legitimately need to drop a table, use:
```sql
DROP TABLE [dbo].[TableName]  -- Run with dryRun: true first, then confirm
```

---

### Q31: Is my `.env` file secure?

**A:** `.env` contains your SQL Server password. **Never commit it to Git**—it's in `.gitignore`. However:
1. Store `.env` locally only
2. For team/CI deployments, use environment variables instead
3. Rotate passwords regularly
4. Use `DB_TRUST_SERVER_CERTIFICATE=false` in production + provide a valid certificate

---

### Q32: Can agents see or modify data outside my database schema?

**A:** No. Agents can only:
- Read schema metadata (table/proc names, columns, constraints)
- Execute SQL scripts you provide
- Read/write workspace files (README, SQL scripts, docs)

Agents cannot access other databases, file systems (beyond workspace), or external systems.

---

### Q33: Are all tool calls logged/audited?

**A:** Yes. An **audit hook** (`audit-logger.json`) logs every tool call:
- Tool name, input parameters, output
- Timestamp, agent name, result status

**Log file**: `logs/agent-audit.log`

---

## Troubleshooting

### Q34: The MCP server won't start. What do I do?

**A:**
1. Check Node.js version: `node --version` (must be 18+)
2. Navigate to `mcp-server/` and try rebuilding:
   ```bash
   npm run build
   ```
3. Check for TypeScript errors in the output
4. Verify `.env` exists and is correctly formatted
5. Check that no other process is using port 3000 (or whatever port is configured)
6. Restart VS Code

---

### Q35: I get "Cannot connect to database" error.

**A:**
1. Verify SQL Server is running (e.g., check SQL Server Configuration Manager on Windows)
2. Check `.env` values:
   - `DB_SERVER`: Use `localhost` for local, `IP_ADDRESS` for remote
   - `DB_DATABASE`: Database name must exist
   - `DB_USER` / `DB_PASSWORD`: Credentials must be correct
3. Test the connection manually in SSMS or `sqlcmd`:
   ```bash
   sqlcmd -S localhost -d YourDatabase -U sa -P YourPassword
   ```
4. If remote: Ensure SQL Server is listening on the network, firewalls are open (port 1433 default)

---

### Q36: An agent generated incorrect SQL. How do I fix it?

**A:**
1. Don't execute the bad SQL (review dry-run first!)
2. Ask the agent to regenerate with more specific requirements:
   ```
   @sql-impl-agent I need to fix the stored procedure. The issue is [specific problem].
   Please regenerate with [specific correction].
   ```
3. Or, manually fix the SQL file and ask the code-review agent to review it

---

### Q37: The dry-run succeeded but execution failed. Why?

**A:** Common causes:
1. **Schema changed** between dry-run and execution (another user modified the database)
2. **Permissions**: User running the SQL doesn't have CREATE/ALTER permissions
3. **Constraints violated**: Data doesn't meet FK/unique constraints
4. **Transaction timeout**: Long-running script hit a timeout

**Solution**: 
- Check the error message from `run_sql` 
- Fix the underlying issue (permissions, constraints, schema)
- Re-run with dry-run first

---

### Q38: My test procedures aren't being detected.

**A:**
1. Verify procedure names start with `usp_Test_` (case-sensitive)
2. Ensure they have the correct return columns: `Status`, `ErrorMessage`, `Expected`, `Actual`
3. Check that procedures are in the correct database (matches `.env DB_DATABASE`)
4. If using tSQLt, verify the `tSQLt` schema exists: `SELECT * FROM tSQLt.Tests`

---

### Q39: How do I debug what an agent is doing?

**A:**
1. **Check the audit log**: `logs/agent-audit.log` shows every tool call and result
2. **Check console output**: VS Code Copilot Chat displays agent thinking and intermediate results
3. **Manually run tools**: Call `get_db_schema` or `run_sql` directly to see outputs
4. **Check MEMORY.md**: See what state the orchestrator has stored

---

### Q40: Can I run agents in VS Code Copilot Extensions?

**A:** Custom agents (the `@` mention syntax) work in **VS Code with GitHub Copilot Chat extension**. They do NOT work in:
- GitHub.com Copilot web UI
- GitHub CLI
- VS Code but without Copilot Chat extension

**Requirement**: VS Code 1.120+ with GitHub Copilot and GitHub Copilot Chat extensions.

---

## Advanced Questions

### Q41: How do I add a new custom agent?

**A:**
1. Create a `.agent.md` file in `.github/agents/my-new-agent.agent.md`
2. Follow the existing agent format (see `e2e-orchestrator.agent.md` for template)
3. Reference relevant skills: `@skill sql-tsql-standards`, `@skill schema-analysis`, etc.
4. Reference MCP tools in your prompt: `Use the get_db_schema tool to fetch the schema...`
5. Restart VS Code to register the new agent

---

### Q42: How do I customize the MCP server or add new tools?

**A:**
1. Edit files in `mcp-server/src/tools/`
2. Add tool definitions to `mcp-server/src/index.ts`
3. Run `npm run build` to compile
4. Restart VS Code

The MCP server is open-source; you can extend it with custom SQL tools, reporting tools, etc.

---

### Q43: Can I run the orchestrator outside of VS Code (e.g., in automation)?

**A:** Not directly. The agents are built for **GitHub Copilot Chat** in VS Code. However:
1. The **MCP server** can be called programmatically (it's a Node.js process)
2. You could build a custom CLI or automation layer that calls the MCP tools
3. Or, use GitHub's API to integrate agents into workflows

---

### Q44: How do I backup my database before running agents?

**A:**
1. **Backup manually** before starting any pipeline:
   ```sql
   BACKUP DATABASE [YourDatabase] 
   TO DISK = N'C:\Backups\YourDatabase_2026-05-28.bak'
   ```
2. Or, wrap your entire feature work in a **transaction** (SQL Server transaction, not MCP tool):
   ```sql
   BEGIN TRANSACTION
   -- Agents run their SQL here
   -- If anything fails: ROLLBACK TRANSACTION
   -- If everything ok: COMMIT TRANSACTION
   ```

---

### Q45: Can I version-control my MEMORY.md file or SQL scripts?

**A:** Yes! 
- **SQL scripts**: Commit them to version control (they're your source code)
- **MEMORY.md**: You can commit it, but it becomes stale as agents update it. Consider `.gitignore` for automatic pipeline runs, or commit it for manual review steps.
- **output/ documents**: Already in `.gitignore` (not version-controlled)

**Best practice**: Commit finalized SQL scripts; ignore the intermediate MEMORY.md and generated docs.

---

## Getting Help

### Q46: Where do I find documentation?

**A:** Documentation is in the repository root:
- **README.md**: Overview, quick start, usage examples
- **walkthrough.md**: Complete architecture, skills, hooks, prompts explanation
- **FAQ.md** (this file): Frequently asked questions

---

### Q47: What if my question isn't answered here?

**A:**
1. Check the **README.md** and **walkthrough.md** for detailed explanations
2. Review the agent definition files in `.github/agents/` for prompt details
3. Check the skill files in `.github/skills/` for tool usage patterns
4. Review the MCP server code in `mcp-server/src/` for tool implementations
5. Check the audit log in `logs/agent-audit.log` for what tools are actually being called
6. Open a GitHub issue in the repository with details

---

### Q48: How do I report a bug?

**A:** 
1. Reproduce the issue step-by-step
2. Collect evidence:
   - `.env` configuration (no passwords!)
   - Full error message/chat transcript
   - `logs/agent-audit.log` entries
   - `MEMORY.md` state at the time
3. Open a GitHub issue with all details (or contact the project maintainer)

---

### Q49: Can I contribute improvements to the agents or MCP server?

**A:** Yes! This is an open-source project. 
1. Fork the repository
2. Create a feature branch
3. Make your improvements
4. Test thoroughly
5. Submit a pull request

The codebase includes skills, hooks, and prompts that make it easy to extend.

---

### Q50: Where can I see recent changes or updates?

**A:** 
- Check **git commit history**: `git log --oneline`
- Check **GitHub releases**: GitHub Releases tab
- Review **CHANGELOG.md** if maintained
- Subscribe to repository notifications (Watch button)

---

## Summary

These agents streamline SQL Server development from **requirements to testing**. Key takeaways:

✅ **Start with the orchestrator** (`@e2e-orchestrator`)
✅ **Always dry-run first** before executing SQL
✅ **Check MEMORY.md** for pipeline state
✅ **Review audit logs** (`logs/agent-audit.log`) when debugging
✅ **Never commit `.env`** (contains passwords)
✅ **Leverage skills** (sql-tsql-standards, schema-analysis) for consistency
✅ **Use negative IDs** in test data to avoid conflicts

Happy building! 🚀

