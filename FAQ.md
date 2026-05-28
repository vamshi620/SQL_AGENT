# Frequently Asked Questions (FAQ)

## General Agent Concepts

### 1. What is the Difference Between a General Chat Agent vs. Custom Agent?

**General Chat Agent:**
- A **generic, multipurpose AI assistant** (like ChatGPT or standard Copilot)
- Has no specialized knowledge about your codebase, database, or business domain
- Cannot directly access your SQL Server or file system
- Responds based only on general AI training data and your prompt
- No built-in safety guardrails for database operations

**Custom Agent:**
- A **specialized assistant tailored to your specific workflow** (e.g., the E2E orchestrator)
- Has **domain knowledge** injected via skills, instructions, and prompts
- **Directly integrates** with your database, file system, and tools via MCP (Model Context Protocol)
- Can execute SQL, read/write files, generate Word documents, and run unit tests
- **Enforces rules and best practices** through hooks (e.g., security gates, dry-run validation)
- Designed for a specific pipeline or domain (in this case: SQL Server E2E development)

**Example:**
- **General Chat Agent**: "How do I create a stored procedure?" → Returns generic SQL examples
- **Custom Agent** (@sql-impl-agent): "Create a loyalty points procedure" → Fetches YOUR live schema, generates SQL matching YOUR standards, dry-runs it, and executes it safely

---

### 2. Why Use Custom Agents?

**Because they deliver outcomes, not just information:**

1. **Domain Expertise** — Built with skills, instructions, and hooks that encode your best practices
2. **Tool Integration** — Direct access to your SQL Server, file system, Word generation, and testing frameworks
3. **Safety** — Hooks enforce security policies (e.g., no DROP without confirmation, mandatory dry-run first)
4. **Consistency** — Every agent follows the same naming conventions, error handling, and documentation standards
5. **End-to-End Automation** — Orchestrate a complete workflow: Requirements → SQL → Review → Tests in one session
6. **Context Awareness** — Agents read MEMORY.md to track pipeline state, so each step knows what the previous step did
7. **Reduced Manual Work** — No copy-pasting queries or writing boilerplate; agents generate production-ready code

**Real-world benefit:** With custom agents, you go from "I need a loyalty points system" to "Here's the schema, stored procedures, code review, and unit tests" in one structured workflow.

---

### 3. How Do Agents Get Skills on DB Schema and Business Logic?

Custom agents acquire knowledge through **four mechanisms:**

1. **Live Schema Introspection**
   - Every agent calls `get_db_schema` to fetch the **current, live database schema**
   - This provides: table names, columns, data types, primary/foreign keys, indexes, and relationships
   - The `schema-analysis` skill teaches agents how to interpret this schema output
   - **Result**: Agents never assume; they always verify against reality

2. **Skills Library**
   - Skills are **reusable knowledge modules** stored in `.github/skills/`
   - Examples: `sql-tsql-standards` (naming conventions, security rules), `schema-analysis` (how to read schema), `sql-test-patterns` (test templates)
   - Agents reference these skills in their YAML frontmatter
   - **Result**: Best practices are encoded once, reused everywhere

3. **MEMORY.md — The Session Whiteboard**
   - All agents read/write a shared `MEMORY.md` file during the pipeline
   - This file tracks: feature requirements, affected tables, generated SQL scripts, test results, findings
   - Each agent builds on the work of the previous agent
   - **Result**: Context flows through the entire pipeline

4. **Agent Instructions**
   - Each agent has a `.agent.md` file with **detailed system instructions**
   - Instructions specify: what the agent should do, which tools to use, error handling, output format
   - Instructions can reference skills via slash commands (e.g., `/sql-standards`)
   - **Result**: Agents know exactly what's expected

**Example Workflow:**
```
User: "@requirements-agent I need a discount code system"
       │
       ▼
Agent reads live schema → identifies OrderHeader, OrderDetail, Customer tables
       │
       ▼
Agent uses schema-analysis skill → understands relationships
       │
       ▼
Agent writes MEMORY.md with: feature goal, affected tables, business logic
       │
       ▼
Next agent (sql-impl-agent) reads MEMORY.md → knows exactly what to build
```

---

### 4. How Are Agents Aware of and Connected to SQL Server and Database?

Agents connect to your SQL Server through **two components:**

**1. Environment Configuration (.env file)**

The `.env` file contains SQL Server connection details:
```env
DB_SERVER=localhost
DB_DATABASE=YourDatabase
DB_USER=sa
DB_PASSWORD=YourPassword!
DB_TRUST_SERVER_CERTIFICATE=true
```

- These credentials are **loaded at MCP server startup** by the `config.ts` module
- They are **never committed to GitHub** (`.gitignore` protects them)
- The config is validated on startup; if invalid, the MCP server will not start

**2. MCP (Model Context Protocol)**

MCP is the **bridge between agents and tools**:

- **What it does**: Exposes agent tools (like `get_db_schema`, `run_sql`) to Copilot
- **Where it runs**: In the `mcp-server/` directory (Node.js TypeScript server)
- **How it connects**: Via `.vscode/mcp.json`, which registers the MCP server with VS Code Copilot
- **Tool execution**: When an agent calls `run_sql`, the MCP server uses the `.env` credentials to execute it

**Connection Flow:**
```
Agent invokes: "run_sql({sqlScript, dryRun: true})"
       │
       ▼
Copilot routes to MCP server
       │
       ▼
MCP server reads .env credentials
       │
       ▼
Creates SQL connection using mssql package
       │
       ▼
Executes query against SQL Server
       │
       ▼
Returns results to agent
```

**Troubleshooting Connection Issues:**

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Check `.env` credentials and SQL Server is running |
| "Tools not showing in Copilot" | Rebuild MCP: `cd mcp-server && npm run build` |
| "Tool call timed out" | Query may be slow; increase SQL Server timeout in `mcp-server/src/config.ts` |
| "Permission denied" | Ensure the `.env` user account has SELECT, INSERT, UPDATE, DELETE privileges |

---

## MCP (Model Context Protocol)

### 5. What is MCP and What is Its Role?

**MCP (Model Context Protocol) is the standard that lets AI agents use tools.**

Think of it like a **contract between the agent and the tools**:
- Agent says: "I want to run SQL with these parameters"
- MCP server says: "OK, I understand. Here's the result"
- Both sides speak the same language (JSON-RPC messages)

**In this project, MCP does three critical things:**

1. **Exposes Tools**
   - MCP server defines 7 tools that agents can call:
     - `get_db_schema` — fetch database metadata
     - `run_sql` — execute T-SQL scripts (with dry-run safety)
     - `generate_word_doc` — create Word documents
     - `run_unit_tests` — run unit tests (tSQLt or custom)
     - `read_file` — read workspace files (MEMORY.md, SQL scripts)
     - `write_file` — write/append workspace files
     - `list_files` — list directory contents

2. **Enforces Standards**
   - MCP server validates all tool calls
   - Example: `run_sql` validates SQL syntax before execution
   - Example: `generate_word_doc` validates document structure
   - This prevents agents from accidentally calling tools with invalid parameters

3. **Manages State**
   - MCP server runs **lifecycle hooks** that intercept tool calls
   - Security hook: blocks DROP/TRUNCATE without confirmation
   - Audit hook: logs all tool calls to `logs/agent-audit.log`
   - Context hook: injects session state at startup

**MCP Architecture in This Project:**

```
.vscode/mcp.json
       │ (registers with VS Code)
       ▼
mcp-server/dist/index.js
       │
       ├─→ tool: get_db_schema
       ├─→ tool: run_sql (+ hooks: security-gate, dry-run-enforcer, audit-logger)
       ├─→ tool: generate_word_doc
       ├─→ tool: run_unit_tests
       ├─→ tool: read_file
       ├─→ tool: write_file
       └─→ tool: list_files
              │
              ▼
        SQL Server (via .env credentials)
        File System (workspace files)
```

**Why it matters:**
- Without MCP, agents couldn't execute SQL or generate documents — they'd just give advice
- With MCP, agents are **hands-on tools** that deliver results

---

## Testing and Fallback Scenarios

### 6. How Do Agents Handle Fallout Test Cases? (e.g., No Records Found)

The unit-test-agent is designed to handle edge cases and unexpected scenarios gracefully.

**Common Fallout Test Cases:**

1. **No Records Found (e.g., "No claims with ID 003 available")**
   - **Agent behavior**: Test is marked PASS or FAIL based on the assertion
   - **Pattern**: Negative ID testing ensures tests never conflict with production data
   - **Example**:
     ```sql
     CREATE PROCEDURE usp_Test_ClaimLookup_NoClaimFound
     AS
     BEGIN
         DECLARE @Result NVARCHAR(MAX);
         EXEC usp_GetClaim @ClaimID = -999, @Result OUTPUT;
         
         IF @Result IS NULL
             SELECT 'PASS' AS Status, NULL AS ErrorMessage, 'NULL' AS Expected, 'NULL' AS Actual;
         ELSE
             SELECT 'FAIL' AS Status, 'Expected NULL claim' AS ErrorMessage, 'NULL' AS Expected, @Result AS Actual;
     END
     ```

2. **Empty Result Set**
   - **Agent behavior**: Validates that procedures handle empty sets correctly (no NULL pointer exceptions, no silent failures)
   - **Test approach**: Insert no records, then query → verify clean empty result

3. **Invalid Input Parameters**
   - **Agent behavior**: Tests verify that stored procedures reject invalid data types or out-of-range values
   - **Test pattern**:
     ```sql
     CREATE PROCEDURE usp_Test_AddPoints_NegativeAmount
     AS
     BEGIN
         DECLARE @Error NVARCHAR(MAX);
         
         BEGIN TRY
             EXEC usp_AddPoints @CustomerID = 1, @Points = -10;
             SELECT 'FAIL' AS Status;
         END TRY
         BEGIN CATCH
             SELECT 'PASS' AS Status;  -- Expected to fail
         END CATCH
     END
     ```

4. **Duplicate Key Violations**
   - **Agent behavior**: Tests verify that unique constraints are enforced
   - **Test pattern**: Insert same record twice, verify second insert fails gracefully

5. **Transaction Rollback Scenarios**
   - **Agent behavior**: Tests verify that procedures roll back on error without leaving partial data
   - **Pattern**: Insert in TRY block, trigger error in CATCH, verify no orphaned records

**How the Agent Discovers and Runs These Tests:**

```
Agent calls: run_unit_tests()
       │
       ▼
Auto-detect test framework
       ├─→ IF tSQLt schema exists: EXEC tSQLt.RunAll
       └─→ ELSE: Find all procs matching usp_Test_* pattern
              │
              ▼
       For each test procedure:
              │
              ├─→ Execute it
              ├─→ Parse output (Status, ErrorMessage, Expected, Actual)
              ├─→ Mark PASS/FAIL
              └─→ Collect results
              │
              ▼
       Generate test report Word document
       with passing/failing tests
```

**Agent's Response to Failures:**

- If a fallout test **FAILS** → documented in test report with expected vs. actual values
- If a fallout test **PASSES** (as expected) → confirms edge case handling works
- Agent **never stops on first failure** → runs all tests, then reports summary

---

### 7. Does the Agent Get Trained or Skilled from Output?

**No, agents do NOT learn or get "trained" from previous outputs.**

Each agent invocation starts **fresh** with:
- Hardcoded instructions in its `.agent.md` file
- Reusable skills from `.github/skills/`
- The current MEMORY.md state (which contains output from previous agents)

**But here's the key distinction:**

1. **Agent Knowledge (Static)**
   - Agent instructions, skills, and hooks are **baked in** when the agent is deployed
   - They don't change based on previous runs
   - A new deployment or instruction update is required to change agent behavior

2. **Session State (Dynamic)**
   - MEMORY.md is **reused across agent invocations** within a pipeline run
   - Each agent reads the outputs of previous agents
   - This allows **contextual awareness** (e.g., sql-impl-agent knows what requirements agent discovered)
   - But this is **not learning**; it's just **passing state forward**

**Example:**

```
Run 1: @requirements-agent discovers that Customers table exists
       → MEMORY.md is updated
       → @sql-impl-agent reads MEMORY.md and uses this knowledge
       
Run 2: User runs same feature again
       → New MEMORY.md is created (blank)
       → @requirements-agent discovers Customers table again
       → Agent had the same knowledge both times (from instructions/skills)
```

**If you want the agent to "learn" (improve over time), you must:**
1. Update the agent's `.agent.md` instructions with new best practices
2. Add new rules to skills (e.g., add naming convention to `sql-tsql-standards`)
3. Add new hooks (e.g., add security policy to `security-gate.json`)
4. Rebuild the MCP server: `cd mcp-server && npm run build`

---

## User Troubleshooting

### 8. If Agent Output is Not as Expected, How Can I (End User) Rectify It?

**Step-by-step troubleshooting guide:**

#### A. Verify Your Input

**Check that your request was clear:**
- Did you provide enough context?
- Example: ❌ "Create a procedure" vs. ✅ "Create a procedure to calculate loyalty points for orders > $100"
- Solution: Re-run the agent with a more specific request

#### B. Check MEMORY.md

**If you're mid-pipeline:**
1. Open `MEMORY.md` in the workspace
2. Verify that the previous agent's findings are correct
3. If incorrect, manually edit MEMORY.md and re-run the current agent

**Example:**
```markdown
## Schema Context
- ❌ Agent claimed there's a "DiscountRate" column
- ✓ You know it's actually "DiscountPercentage"
→ Edit MEMORY.md, then re-run @sql-impl-agent
```

#### C. Review the Generated Output

**Check the Word documents or SQL scripts:**
1. Requirements doc: Does it match your business requirements?
2. SQL script: Does it follow naming conventions? Is the logic correct?
3. Code review: Did it catch real issues?
4. Test report: Do all tests pass?

**If output is wrong:**
- Provide feedback directly to the agent
- Example: "@code-review-agent The stored procedure naming should use prefix `proc_` not `usp_`"
- Agent will adjust in next run

#### D. Check Database Connection

**If the agent can't connect:**
```bash
# 1. Verify .env file exists and has correct credentials
cat .env

# 2. Rebuild MCP server
cd mcp-server
npm run build

# 3. In VS Code, restart Copilot Chat (Cmd/Ctrl + Shift + Delete)

# 4. Try a simple query
@sql-impl-agent Run: SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
```

#### E. Check Agent Logs

**Audit logs show what every agent did:**
```bash
cat logs/agent-audit.log
```

**Look for:**
- Failed tool calls with error messages
- SQL syntax errors
- Permission denied errors
- Timeout errors

#### F. Run Dry-Run First

**Always validate before executing:**
```
@sql-impl-agent 
Please generate the stored procedure first, then run it with dry-run (dryRun: true) 
so I can review the SQL before you execute it.
```

#### G. Provide Explicit Constraints

**If agent made wrong assumptions, be explicit:**
- ❌ "Add a discount feature"
- ✅ "Add a discount feature. Discounts apply only to orders > $500. Use the DiscountPercentage column in Products table."

**Common Issues and Fixes:**

| Issue | Cause | Fix |
|-------|-------|-----|
| "Column not found" | Agent used wrong column name | Edit MEMORY.md with correct names; re-run agent |
| "Procedure already exists" | Agent didn't check for existing proc | Manual cleanup: `DROP PROCEDURE usp_Name` then re-run |
| "Permission denied" | SQL user lacks privileges | Check `.env` user has DB_OWNER or required role |
| "Stored proc doesn't match standards" | Agent instructions outdated | Update `.github/copilot-instructions.md` with new standards |
| "Wrong number of unit tests" | Agent didn't discover all test procs | Check naming: all procs must match `usp_Test_*` pattern |

---

## Customization

### 9. How Do I Customize or Update an Existing Agent?

Custom agents are fully customizable. Here's how:

#### A. Modify Agent Instructions

**File**: `.github/agents/<agent-name>.agent.md`

1. Edit the **YAML frontmatter**:
   ```yaml
   tools:           # Add/remove available tools
     - get_db_schema
     - run_sql
   
   skills:          # Add/remove skills
     - schema-analysis
     - sql-tsql-standards
   
   handoffs:        # Customize handoff buttons
     - label: "My Custom Step"
       agent: another-agent
   ```

2. Edit the **System Instructions** (markdown section below YAML):
   - Rewrite the agent's personality and rules
   - Add new constraints or requirements
   - Update examples

**Example: Update SQL Implementation Agent**

**Current behavior**: Creates one procedure at a time

**Desired behavior**: Create multiple related procedures in one go

**Change**:
```markdown
## Edit: .github/agents/sql-impl-agent.agent.md

### Current (old):
"When you finish implementing the first procedure, ask the user if they need more."

### New (updated):
"Generate all related procedures in a single execution, grouped by entity. 
For example, for a loyalty system generate usp_AddPoints, usp_RedeemPoints, 
and usp_GetBalance in one go."
```

#### B. Create a New Skill

**If you have repeatable best practices, encode them as a skill:**

1. Create a new skill directory:
   ```bash
   mkdir .github/skills/my-new-skill
   ```

2. Create `SKILL.md`:
   ```markdown
   # My New Skill
   
   This skill teaches agents how to [do something].
   
   ## Checklist
   - [ ] Item 1
   - [ ] Item 2
   
   ## Examples
   [code examples]
   ```

3. Reference it in agent YAML:
   ```yaml
   skills:
     - my-new-skill
   ```

#### C. Add or Update a Hook

**Hooks intercept tool calls to enforce policies:**

1. Create hook file: `.github/hooks/<hook-name>.json`
   ```json
   {
     "name": "my-security-hook",
     "events": ["preToolUse"],
     "description": "Block dangerous operations",
     "rules": [
       {
         "condition": "tool == 'run_sql' && contains(sql, 'DELETE')",
         "action": "ask_user",
         "message": "DELETE detected. Confirm?"
       }
     ]
   }
   ```

2. Register in global instructions:
   ```markdown
   # .github/copilot-instructions.md
   
   ## Active Hooks
   - my-security-hook
   - audit-logger
   ```

#### D. Update MCP Server Tools

**If you need new tool capabilities:**

1. Add new tool in `mcp-server/src/tools/`:
   ```typescript
   // mcp-server/src/tools/my-new-tool.ts
   export async function myNewTool(params: MyParams): Promise<Result> {
     // implementation
   }
   ```

2. Register in `mcp-server/src/index.ts`:
   ```typescript
   server.tool("my_new_tool", "Description", myNewTool);
   ```

3. Rebuild:
   ```bash
   cd mcp-server
   npm run build
   ```

4. Use in agent:
   ```yaml
   tools:
     - my_new_tool
   ```

#### E. Update Global Instructions

**Rules that apply to ALL agents:**

File: `.github/copilot-instructions.md`

```markdown
## SQL Standards (example update)
- Use `NVARCHAR` (not `VARCHAR`)
- New rule: Always add column-level comments
- New rule: Use schema prefix in queries (dbo.TableName not just TableName)
```

#### F. Update Skills

**Best practices shared across agents:**

File: `.github/skills/<skill-name>/SKILL.md`

```markdown
## Before
- Use tSQLt for testing

## After (updated)
- Prefer tSQLt if available
- Fall back to custom usp_Test_* procedures
- New: Always include negative tests
```

#### G. Deployment Checklist

After customization:

1. ✅ **Rebuild MCP server** (if tool changes):
   ```bash
   cd mcp-server
   npm run build
   ```

2. ✅ **Test the agent locally** in VS Code Copilot Chat:
   ```
   @my-agent Please do [test task]
   ```

3. ✅ **Verify output** matches your new rules

4. ✅ **Commit changes** to git:
   ```bash
   git add .github/agents/ .github/skills/ .github/hooks/ mcp-server/
   git commit -m "Customize agents: add new rule X"
   ```

5. ✅ **Push to team** so everyone gets the updated agents

#### H. Customization Examples

**Example 1: Enforce New Naming Convention**

Change from `usp_<Entity>_<Action>` to `proc_<Entity>_<Action>`:

```markdown
# Edit: .github/copilot-instructions.md

## Naming — Updated
- Stored procedures: `proc_<Entity>_<Action>` (was: `usp_`)
  - Example: proc_Customer_Insert, proc_Order_Update
- Tables: Still PascalCase plural (Orders, Customers)
- Indexes: Still IX_<Table>_<Col>
```

**Example 2: Require Test Coverage**

Add to requirements-agent instructions:

```markdown
# .github/agents/requirements-agent.agent.md

## New Requirement
"For each stored procedure, specify at least 3 test cases:
1. Happy path (normal input)
2. Boundary condition (edge case)
3. Error case (invalid input)"
```

**Example 3: Add Automated Code Review**

Create new skill `.github/skills/auto-code-review/SKILL.md`:

```markdown
# Auto Code Review Checklist

- [ ] No hardcoded values
- [ ] All strings are NVARCHAR
- [ ] All procedures have error handling
- [ ] All tables have primary keys
- [ ] No orphaned foreign keys
```

---

## Additional Resources

### Quick Links

- **README.md** — Project overview and quick start
- **walkthrough.md** — Detailed architecture walkthrough
- **.github/copilot-instructions.md** — Global rules for all agents
- **.github/skills/** — Reusable knowledge modules
- **MEMORY.md** — Pipeline state tracker (auto-created)
- **logs/agent-audit.log** — All tool calls and results

### Common Commands

```bash
# Rebuild MCP server after changes
cd mcp-server
npm run build

# View agent audit log
tail -f logs/agent-audit.log

# Start fresh (delete session state)
rm MEMORY.md

# View SQL Server connection status
# (MCP server validates this on startup)
echo "Check .env file and test connection in VS Code"
```

### Getting Help

1. **Agent not responding**: Restart Copilot Chat (Cmd/Ctrl + Shift + Delete)
2. **Tools not showing**: Rebuild MCP: `npm run build` in mcp-server/
3. **SQL error**: Check `logs/agent-audit.log` for the exact error
4. **Unexpected behavior**: Check and edit `MEMORY.md` to correct state
5. **Want new feature**: Create a skill or update agent instructions

---

## Summary

| Question | Answer |
|----------|--------|
| **General vs. Custom Agent** | General agents give advice; custom agents execute work via MCP |
| **Why Custom Agents** | Domain expertise, tool integration, safety, consistency, end-to-end automation |
| **How agents know DB schema** | Live schema fetch via `get_db_schema` + skills + MEMORY.md state tracking |
| **How agents connect to SQL** | Via `.env` credentials loaded by MCP server + mssql package |
| **What is MCP** | Protocol that exposes tools (run_sql, get_db_schema, etc.) to agents |
| **MCP role** | Enforces standards, manages state, runs lifecycle hooks (security, audit, context) |
| **Fallout test cases** | Agent uses negative IDs, tests expected failures, validates empty sets and errors |
| **Agent learning** | No automatic learning; state flows via MEMORY.md; behavior changes via instruction/skill updates |
| **Troubleshooting** | Check MEMORY.md, review output, verify DB connection, check logs, provide clearer input |
| **Customization** | Update agent instructions, create skills, add hooks, rebuild MCP, commit changes |

