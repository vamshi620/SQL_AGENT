# E2E GitHub Copilot Custom Agents

A suite of **5 GitHub Copilot custom agents** for end-to-end SQL Server development — from requirements to testing — orchestrated by a master agent and powered by a shared **MCP (Model Context Protocol) server**.

---

## 🤖 Agents

| Agent | Invoke | What it does |
|---|---|---|
| **Orchestrator Agent** | `@e2e-orchestrator` | **MAIN ENTRY POINT**. Coordinates the other agents, manages pipeline state (`MEMORY.md`), and outputs a final completion summary |
| **Requirements Agent** | `@requirements-agent` | Step 1: Analyzes requirements + fetches live DB schema + generates Word requirements doc |
| **SQL Implementation Agent** | `@sql-impl-agent` | Step 2: Writes T-SQL (DDL/DML/stored procs) based on requirements, dry-run validates, executes |
| **Code Review Agent** | `@code-review-agent` | Step 3: Reviews SQL code for security, performance, standards → generates Word review report |
| **Unit Testing Agent** | `@unit-test-agent` | Step 4: Deploys SQL, runs tSQLt or custom test procs, generates Word test report |

---

## 🏗️ Architecture

```
.github/agents/           ← Agent definitions (2026 .agent.md format)
mcp-server/               ← Shared MCP Server (Node.js + TypeScript)
  src/
    index.ts              ← MCP server entry, registers all 7 tools
    config.ts             ← DB connection from .env
    tools/
      db-schema.ts        ← get_db_schema tool
      run-sql.ts          ← run_sql tool (with dry-run)
      generate-docx.ts    ← generate_word_doc tool
      run-tests.ts        ← run_unit_tests tool
      file-system.ts      ← read_file, write_file, list_files tools
.vscode/mcp.json          ← Registers MCP server with VS Code Copilot
output/                   ← Generated Word documents
```

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **VS Code** 1.120+ with **GitHub Copilot** and **GitHub Copilot Chat** extensions
- **SQL Server** instance (local or remote)

### 1. Configure Database Connection

```bash
# Copy the example env file
copy .env.example .env
```

Edit `.env` with your SQL Server details:
```env
DB_SERVER=localhost
DB_DATABASE=YourDatabase
DB_USER=sa
DB_PASSWORD=YourPassword!
DB_TRUST_SERVER_CERTIFICATE=true
```

### 2. Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 3. Open in VS Code

```bash
# Open the project root in VS Code
code c:\VAMSHI\E2Eagent
```

VS Code will automatically detect `.vscode/mcp.json` and register the MCP server with Copilot.

> **Verify**: Open Copilot Chat → click the Tools icon → you should see `get_db_schema`, `run_sql`, `generate_word_doc`, `run_unit_tests` listed.

---

## 💬 Usage Examples

### Requirements Agent
```
@requirements-agent I need to add a customer loyalty points system. 
Customers earn points on each order and can redeem them for discounts.
```
→ Fetches schema → Analyzes → Saves `output/requirements-loyalty-points-2026-05-23.docx`

---

### SQL Implementation Agent
```
@sql-impl-agent Based on the loyalty points requirements, create the 
LoyaltyPoints table, usp_AddPoints and usp_RedeemPoints procedures.
```
→ Fetches schema → Generates SQL → Dry-runs → Asks confirmation → Executes

---

### Code Review Agent
```
@code-review-agent Please review sql/002_LoyaltyPoints_Procedures.sql
```
→ Fetches schema → Analyzes code → Saves `output/code-review-LoyaltyPoints-2026-05-23.docx`

---

### Unit Testing Agent
```
@unit-test-agent Deploy sql/002_LoyaltyPoints_Procedures.sql and run 
all unit tests for the loyalty points feature.
```
→ Deploys SQL → Runs tests → Saves `output/test-report-loyalty-points-2026-05-23.docx`

---

## 🛠️ MCP Tools Reference

| Tool | Description | Key Parameters |
|---|---|---|
| `get_db_schema` | Fetch SQL Server schema | `tables[]` (optional filter) |
| `run_sql` | Execute SQL script | `sqlScript`, `dryRun` (default: false) |
| `generate_word_doc` | Create Word document | `filename`, `title`, `sections[]` |
| `run_unit_tests` | Run DB unit tests | `deploymentSql`, `testProcedures[]` |
| `read_file` | Read workspace file (e.g., MEMORY.md) | `filePath` (relative to root) |
| `write_file` | Write/append workspace file | `filePath`, `content`, `append` |
| `list_files` | List workspace directory | `directory`, `pattern`, `recursive` |

---

## 📁 Output Files

All generated Word documents are saved to `output/` with this naming convention:

```
output/
  requirements-<feature>-<date>.docx
  code-review-<object>-<date>.docx
  test-report-<feature>-<date>.docx
```

---

## 🔒 Security Notes

- The `.env` file is in `.gitignore` — never commit your credentials
- `run_sql` always wraps in a transaction; use `dryRun: true` for safe previewing
- Unit tests use negative IDs to avoid conflicting with production data
- All database calls use parameterized queries to prevent SQL injection

---

## 🧪 Unit Testing Framework

The `unit-test-agent` **auto-detects** which framework to use:

| Framework | Detection | How tests are discovered |
|---|---|---|
| **tSQLt** | `tSQLt` schema exists in DB | `EXEC tSQLt.RunAll` |
| **Custom** | Fallback | All procs matching `usp_Test_*` pattern |

### Custom Test Proc Convention
```sql
CREATE OR ALTER PROCEDURE [dbo].[usp_Test_<Suite>_<TestName>]
AS
BEGIN
    -- Returns: Status ('PASS'/'FAIL'), ErrorMessage, Expected, Actual
    SELECT 'PASS' AS Status, NULL AS ErrorMessage, '5' AS Expected, '5' AS Actual;
END
```

---

## 📦 Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.11.0",  ← MCP protocol
  "docx": "^9.0.0",                        ← Word doc generation
  "mssql": "^11.0.1",                      ← SQL Server client
  "dotenv": "^16.4.5",                     ← Environment config
  "zod": "^3.23.8"                         ← Schema validation
}
```

---

## 🚀 Development

```bash
# Run in dev mode (no build step needed)
cd mcp-server
npm run dev

# Rebuild after changes
npm run build

# Watch mode
npm run watch
```
