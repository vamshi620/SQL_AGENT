# MCP-Only Walkthrough

This project is MCP-only and integrates with GitHub Copilot in VS Code through the Model Context Protocol (MCP).

## Overview

The SQL_AGENT is a comprehensive SQL Server development framework that runs entirely through MCP tools and agents. All development workflows are orchestrated via GitHub Copilot Chat in VS Code.

## Prerequisites

- **VS Code** 1.85+
- **Node.js** 18.0.0+
- **GitHub Copilot** + **GitHub Copilot Chat** extensions
- **SQL Server** (running and accessible)
- **.NET Framework** or **SQL Server Management Studio** (optional, for testing)

## Getting Started in VS Code

### 1. Initial Setup

1. **Open the repository in VS Code:**
   ```bash
   code /path/to/SQL_AGENT
   ```

2. **Install extensions** (VS Code will prompt you):
   - GitHub Copilot
   - GitHub Copilot Chat
   - ms-mssql (SQL Server)

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your SQL Server connection details
   ```

4. **Build the MCP server:**
   ```bash
   cd mcp-server
   npm install --ignore-scripts
   npm run build
   ```

5. **Verify MCP connection:**
   - Open GitHub Copilot Chat (Ctrl+Shift+I)
   - You should see MCP tools available at the bottom of the chat input

### 2. Core Workflow

#### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Copilot Chat (VS Code) - Main Interface                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Start with a feature request                           │
│      ↓                                                     │
│  2. Use run_mcp_agent → requirements-agent                │
│      ↓                                                     │
│  3. Get schema: use get_db_schema                         │
│      ↓                                                     │
│  4. Use run_mcp_agent → sql-impl-agent                   │
│      ↓                                                     │
│  5. Validate: run_sql (dryRun: true)                     │
│      ↓                                                     │
│  6. Execute: run_sql (dryRun: false)                     │
│      ↓                                                     │
│  7. Test: run_unit_tests or run_mcp_agent → unit-test   │
│      ↓                                                     │
│  8. Review: run_mcp_agent → code-review-agent            │
│      ↓                                                     │
│  9. Document: generate_word_doc                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Using MCP Tools in Copilot Chat

#### Step 1: Fetch Database Schema
Open Copilot Chat and ask:
```
@workspace Get the current database schema for planning SQL changes
```

The MCP server will call `get_db_schema` and return the live schema from SQL Server.

#### Step 2: Generate Requirements (Optional)
Use the requirements agent:
```
@workspace Run the requirements agent with this feature request: 
"Add customer loyalty points tracking to the orders table"
```

The MCP server calls `run_mcp_agent` with `requirements-agent`.

#### Step 3: Generate SQL Implementation
Use the SQL implementation agent:
```
@workspace Run the sql-impl-agent to generate SQL for adding loyalty points tracking
```

The MCP server calls `run_mcp_agent` with `sql-impl-agent`, which generates:
- DDL scripts (CREATE TABLE, ALTER TABLE)
- DML scripts (INSERT, UPDATE)
- Stored procedures
- Views

#### Step 4: Validate with Dry-Run
Before executing, validate the SQL:
```
@workspace Run the generated SQL in dry-run mode to check for errors
```

The MCP server calls `run_sql` with `dryRun: true`.

#### Step 5: Execute SQL
Once validated, execute the changes:
```
@workspace Execute the SQL changes against the production database
```

The MCP server calls `run_sql` with `dryRun: false`.

#### Step 6: Run Unit Tests
Test the changes:
```
@workspace Run unit tests to verify the implementation
```

The MCP server calls `run_unit_tests` or `run_mcp_agent` + `unit-test-agent`.

#### Step 7: Code Review
Review the generated SQL:
```
@workspace Run code review on the generated SQL scripts
```

The MCP server calls `run_mcp_agent` with `code-review-agent`.

#### Step 8: Generate Documentation
Create Word documents with findings:
```
@workspace Generate a Word document with the test results and implementation summary
```

The MCP server calls `generate_word_doc`.

### 4. Available MCP Agents

| Agent | Purpose |
|-------|---------|
| `e2e-orchestrator` | Orchestrates the entire workflow end-to-end |
| `requirements-agent` | Analyzes requirements and generates specifications |
| `sql-impl-agent` | Generates SQL DDL/DML scripts from requirements |
| `code-review-agent` | Reviews SQL code against best practices |
| `unit-test-agent` | Executes and validates test cases |

### 5. Using MCP Tools Directly

#### Get Database Schema
In Copilot Chat:
```
Call the get_db_schema tool to show me the current tables and structure
```

#### Run SQL
```
Call run_sql with this query: SELECT * FROM Orders, with dryRun: false
```

#### Generate Word Document
```
Call generate_word_doc to create a report with the test findings
```

#### Save CSV
```
Call save_csv to save test results to a CSV file
```

#### Work with Files
```
Call list_files to show workspace files
Call read_file to read path/to/file.sql
Call write_file to save content to path/to/output.sql
```

### 6. Advanced: End-to-End Example

**Scenario:** Add a new customer feedback table

1. **Open Copilot Chat** (Ctrl+Shift+I)

2. **Request end-to-end orchestration:**
   ```
   @workspace Run the e2e-orchestrator agent with this feature request:
   "Create a customer feedback table with fields for rating, comment, and 
   timestamp. Link it to customers and orders tables."
   ```

3. The orchestrator will:
   - Call requirements-agent to generate specifications
   - Call sql-impl-agent to generate SQL
   - Call unit-test-agent to validate
   - Call code-review-agent to review
   - Generate a Word document summary

4. **Execute the approved SQL:**
   ```
   @workspace Execute the generated SQL scripts
   ```

5. **Verify results:**
   ```
   @workspace Run tests to confirm the feedback table is working correctly
   ```

### 7. Development Notes

- **No custom agents:** All orchestration is through MCP
- **No prompt/skill/hook files:** Everything is in the MCP server
- **All development is interactive:** Use Copilot Chat as your main interface
- **Live schema context:** Always fetch fresh schema before generating SQL
- **Dry-run first:** Always validate SQL changes before executing

### 8. Output and Artifacts

Generated files are saved to the directory specified in `.env` (`OUTPUT_DIR`):
- Word documents from `generate_word_doc`
- CSV exports from `save_csv`
- SQL scripts from MCP agents

### 9. Troubleshooting

**Issue:** MCP tools not showing in Copilot Chat
- **Solution:** 
  1. Verify `.vscode/mcp.json` is correct
  2. Run `npm run build` in mcp-server
  3. Reload VS Code (Ctrl+Shift+P → "Developer: Reload Window")

**Issue:** SQL Server connection failed
- **Solution:**
  1. Check `.env` connection string
  2. Test connection from SQL Server Management Studio
  3. Verify firewall allows port 1433 (or your configured port)

**Issue:** npm install fails
- **Solution:**
  1. Delete `node_modules` and `package-lock.json`
  2. Run `npm install --ignore-scripts` again
  3. Ensure Node.js 18+ is installed

**Issue:** Build fails with TypeScript errors
- **Solution:**
  1. Check `tsconfig.json` is correct
  2. Ensure all dependencies are installed
  3. Run `npm run build` again with verbose output

## Summary

The SQL_AGENT MCP server provides a powerful, chat-driven interface for SQL Server development. Everything flows through GitHub Copilot Chat in VS Code:

1. Ask questions in natural language
2. Copilot Chat invokes MCP tools
3. MCP server executes the tools (agents, SQL execution, testing)
4. Results are displayed in chat and saved as artifacts

This keeps your development workflow entirely within VS Code with GitHub Copilot as your intelligent assistant.
