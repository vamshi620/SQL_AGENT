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

### ⚡ NEW: Fully Automated E2E Orchestrator

The **`e2e-orchestrator`** agent now handles complete end-to-end SQL development **automatically**:

**Single call does everything:**
```json
{
  "agent": "e2e-orchestrator",
  "payload": {
    "featureRequest": "Add customer loyalty points tracking to orders table"
  }
}
```

**Orchestrator automatically:**
1. ✅ Analyzes requirements and database schema
2. ✅ Generates and validates SQL (dry-run first, then production)
3. ✅ Reviews code for SQL Server best practices
4. ✅ Generates and executes unit tests
5. ✅ Produces comprehensive final report

**No manual intervention needed!** All stages execute automatically with built-in safety gates.

📖 **Full Guide:** See [E2E_ORCHESTRATOR_GUIDE.md](E2E_ORCHESTRATOR_GUIDE.md) for detailed usage and examples.

### Supported agent names
- `e2e-orchestrator` (⭐ **NEW - Fully Automated**)
- `requirements-agent`
- `sql-impl-agent`
- `code-review-agent`
- `unit-test-agent`

### Discover context
Call `list_mcp_context` to get built-in agent, skill, prompt, and hook mappings.

### Example call (Manual - Individual Agents)
```json
{
  "agent": "requirements-agent",
  "payload": {
    "featureRequest": "Add loyalty points support for customer orders",
    "sessionId": "session-001"
  }
}
```

---

## Getting Started with VS Code

Follow these step-by-step instructions to set up and run the SQL_AGENT in VS Code with MCP support.

### Prerequisites

Before starting, ensure you have the following installed:

1. **VS Code** (version 1.85 or later) - [Download](https://code.visualstudio.com/)
2. **Node.js** (version 18.0.0 or later) - [Download](https://nodejs.org/)
3. **npm** (comes with Node.js)
4. **SQL Server** - Running and accessible on your network
5. **GitHub Copilot** and **GitHub Copilot Chat** extensions installed in VS Code

### Step 1: Clone and Open the Repository

1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/vamshi620/SQL_AGENT.git
   cd SQL_AGENT
   ```

2. Open the repository in VS Code:
   ```bash
   code .
   ```

### Step 2: Install Recommended Extensions

1. VS Code will suggest recommended extensions (see `.vscode/extensions.json`)
2. Install the following extensions:
   - **GitHub Copilot**
   - **GitHub Copilot Chat**
   - **ms-mssql.mssql** (SQL Server extension)

3. Click "Install" when the suggestion popup appears, or manually search for them in the Extensions marketplace (Ctrl+Shift+X)

### Step 3: Configure Environment Variables

1. In the root directory, copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your SQL Server connection details:
   ```
   DB_SERVER=localhost
   DB_PORT=1433
   DB_DATABASE=YourDatabaseName
   DB_USER=sa
   DB_PASSWORD=YourStrongPassword!
   DB_ENCRYPT=false
   DB_TRUST_SERVER_CERTIFICATE=true
   OUTPUT_DIR=../output
   DB_TEST_SCHEMA=dbo_test
   ```

   **Options:**
   - For SQL Server Authentication: Use `DB_USER` and `DB_PASSWORD`
   - For Windows Authentication: Set `DB_TRUSTED_CONNECTION=true`
   - For named instance (SQL Express): Use `DB_SERVER=localhost\SQLEXPRESS` and omit `DB_PORT`

### Step 4: Build and Start the MCP Server

1. Open a terminal in VS Code (Ctrl+`):
   ```bash
   cd mcp-server
   npm install --ignore-scripts
   npm run build
   ```

2. The build output will be in the `mcp-server/dist/` directory

3. VS Code will automatically detect and start the MCP server defined in `.vscode/mcp.json`

### Step 5: Verify MCP Server Connection

1. In VS Code, open GitHub Copilot Chat (Ctrl+Shift+I)
2. The chat should show available MCP tools at the bottom of the input area
3. You should see tools like `get_db_schema`, `run_sql`, `run_unit_tests`, etc.

### Step 6: Use the MCP Tools in Copilot Chat

Once the MCP server is running, you can use it in GitHub Copilot Chat:

1. **Get Database Schema:**
   - In Copilot Chat, type: `@workspace #file:mcp-server` and ask it to fetch the database schema
   - Or reference the `get_db_schema` tool directly

2. **Run SQL Queries:**
   - Use `run_sql` tool to validate SQL with `dryRun: true` first
   - Then execute with `dryRun: false`

3. **Generate Requirements:**
   - Use `run_mcp_agent` to invoke `requirements-agent` for requirements analysis

4. **Implement SQL:**
   - Use `run_mcp_agent` to invoke `sql-impl-agent` for SQL implementation

5. **Review Code:**
   - Use `run_mcp_agent` to invoke `code-review-agent` for SQL Server code reviews

6. **Run Tests:**
   - Use `run_unit_tests` to execute test cases
   - Use `run_mcp_agent` to invoke `unit-test-agent` for comprehensive testing

### Step 7: Development Workflow

**Typical workflow:**

1. Start with a feature request or requirement
2. Use `run_mcp_agent` with `requirements-agent` to analyze requirements
3. Use `run_mcp_agent` with `sql-impl-agent` to generate SQL scripts
4. Validate with `run_sql` in dry-run mode
5. Execute with `run_sql` in production mode
6. Run tests with `run_unit_tests` or `run_mcp_agent` + `unit-test-agent`
7. Review code with `run_mcp_agent` + `code-review-agent`
8. Generate documentation with `generate_word_doc`

### Step 8: Common Tasks

**Checking MCP Context:**
```bash
# In Copilot Chat, ask to call get list_mcp_context to see all available agents and their mappings
```

**Saving Outputs:**
- Use `save_csv` to export test results
- Use `generate_word_doc` to create Word documents with findings
- Use `write_file` to save scripts to the workspace

**Reading Workspace Files:**
- Use `read_file` to view existing files
- Use `list_files` to explore workspace structure

### Troubleshooting

**MCP Server not connecting:**
1. Verify Node.js version: `node --version` (should be v18+)
2. Check mcp-server build: `cd mcp-server && npm run build`
3. Check `.vscode/mcp.json` configuration
4. Restart VS Code (Ctrl+Shift+P → "Developer: Reload Window")

**SQL Server connection errors:**
1. Verify connection string in `.env`
2. Ensure SQL Server is running and accessible
3. Check firewall and network settings
4. Test connection manually from a SQL client first

**Extensions not showing:**
1. Ensure GitHub Copilot is authenticated
2. Check VS Code version (1.85+)
3. Reload extensions: Ctrl+Shift+P → "Developer: Reload Extensions"

**Output directory not found:**
1. Create the output directory: `mkdir ../output`
2. Update `OUTPUT_DIR` in `.env` if using a different path
