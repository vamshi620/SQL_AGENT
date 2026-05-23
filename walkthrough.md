# E2E GitHub Copilot Custom Agents – Complete Walkthrough

## Full Project Structure

```
c:\VAMSHI\E2Eagent\
│
├── .github/
│   ├── copilot-instructions.md          ← Global rules applied to ALL agents
│   │
│   ├── agents/                          ← 5 Custom Agents
│   │   ├── e2e-orchestrator.agent.md    ← Main orchestrator agent
│   │   ├── requirements-agent.agent.md
│   │   ├── sql-impl-agent.agent.md
│   │   ├── code-review-agent.agent.md
│   │   └── unit-test-agent.agent.md
│   │
│   ├── skills/                          ← 5 Reusable Skills
│   │   ├── sql-tsql-standards/SKILL.md  ← Naming, types, security, perf rules
│   │   ├── schema-analysis/SKILL.md     ← How to read get_db_schema output
│   │   ├── sql-test-patterns/SKILL.md   ← Test templates + coverage checklist
│   │   ├── docx-document-writer/SKILL.md← Document section templates
│   │   └── agent-handoff/SKILL.md       ← Pipeline handoff protocols
│   │
│   ├── hooks/                           ← 4 Lifecycle Hooks
│   │   ├── security-gate.json           ← preToolUse: blocks DROP/TRUNCATE
│   │   ├── dry-run-enforcer.json        ← preToolUse: enforce dry-run first
│   │   ├── audit-logger.json            ← pre+postToolUse: log all tool calls
│   │   └── session-context.json         ← sessionStart: inject env status
│   │
│   └── prompts/                         ← 4 Slash-Command Prompts
│       ├── new-pipeline.prompt.md       ← /new-pipeline (initiates orchestrator)
│       ├── run-full-pipeline.prompt.md  ← /run-full-pipeline
│       ├── db-health-check.prompt.md    ← /db-health-check
│       └── generate-unit-tests.prompt.md← /generate-unit-tests
│
├── mcp-server/                          ← Shared MCP Server (Node.js/TypeScript/ESM)
│   ├── src/
│   │   ├── index.ts                     ← 7 tools registered
│   │   ├── config.ts                    ← .env loader (ESM-compatible)
│   │   └── tools/
│   │       ├── db-schema.ts             ← get_db_schema
│   │       ├── run-sql.ts               ← run_sql (dry-run + GO batches)
│   │       ├── generate-docx.ts         ← generate_word_doc (docx v9)
│   │       ├── run-tests.ts             ← run_unit_tests (tSQLt + custom)
│   │       └── file-system.ts           ← read_file, write_file, list_files
│   └── dist/                            ← ✅ Built, 0 errors
│
├── .vscode/
│   ├── mcp.json                         ← MCP server registered with VS Code
│   └── extensions.json                  ← Copilot + MSSQL recommended
│
├── .env.example                         ← SQL Server config template
│   ├── MEMORY.md                        ← Pipeline state / whiteboard file
│   └── README.md
```

---

## Skills — What Each One Does

| Skill | Agents That Use It | Purpose |
|---|---|---|
| `sql-tsql-standards` | sql-impl, code-review | Naming conventions, data types, security, perf rules |
| `schema-analysis` | All 5 agents | Structured interpretation of `get_db_schema` output |
| `sql-test-patterns` | unit-test | Test templates, coverage checklist, tSQLt patterns |
| `docx-document-writer` | requirements, code-review, unit-test | Exact section structures per document type |
| `agent-handoff` | All 5 agents | Structured handoff summaries between pipeline stages |

---

## Hooks — What Each One Does

| Hook File | Events | Effect |
|---|---|---|
| `security-gate.json` | `preToolUse` | Blocks `DROP TABLE`, `TRUNCATE`, `DELETE` without WHERE if not dry-run |
| `dry-run-enforcer.json` | `preToolUse`, `sessionEnd` | Ensures `run_sql dryRun=true` runs before any real execution |
| `audit-logger.json` | `preToolUse`, `postToolUse` | Logs every tool call + result to `logs/agent-audit.log` |
| `session-context.json` | `sessionStart` | Prints project status (.env, MCP build, available agents/skills, MEMORY.md) |

---

## Prompts — Slash Commands

| Prompt File | Slash Command | What It Does |
|---|---|---|
| `new-pipeline.prompt.md` | `/new-pipeline` | Prompts for a feature and starts the main orchestrator agent |
| `run-full-pipeline.prompt.md` | `/run-full-pipeline` | Runs all agents in sequence for a feature |
| `db-health-check.prompt.md` | `/db-health-check` | Runs schema analysis, flags issues |
| `generate-unit-tests.prompt.md` | `/generate-unit-tests` | Generates full test suite for a stored proc |

---

## Skill-to-Agent Matrix

|  | orchestrator | requirements | sql-impl | code-review | unit-test |
|---|:---:|:---:|:---:|:---:|:---:|
| sql-tsql-standards | | | ✅ | ✅ | |
| schema-analysis | ✅ | ✅ | ✅ | ✅ | ✅ |
| sql-test-patterns | | | | | ✅ |
| docx-document-writer | | ✅ | | ✅ | ✅ |
| agent-handoff | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## E2E Workflow with Skills & Hooks

```
User types: /new-pipeline (or @e2e-orchestrator I need to build [feature])
         │
         ▼
[sessionStart hook fires]
→ Checks .env, MCP build, MEMORY.md status, prints welcome banner

         │
         ▼
@e2e-orchestrator
→ Reads MEMORY.md (if exists) or creates it.
→ Calls: get_db_schema (audit-logger logs it)
→ Writes initial state (feature slug, DB name, status table) to MEMORY.md
→ Presents pipeline status and shows handoff buttons:
  [Step 1 - Requirements] [Step 2 - SQL Impl] [Step 3 - Review] [Step 4 - Unit Tests]

         │
         ▼
@requirements-agent (User clicks Step 1)
→ Reads MEMORY.md (via read_file) to get context.
→ Calls: get_db_schema (audit-logger logs it)
→ Calls: generate_word_doc → output/requirements-*.docx
→ Updates MEMORY.md (via write_file) with requirements summary.
→ Prompts user to proceed to Step 2 SQL Implementation.

         │
         ▼
@sql-impl-agent (User clicks Step 2)
→ Reads MEMORY.md (via read_file) to get requirements context.
→ Calls: get_db_schema
→ Generates T-SQL following sql-tsql-standards skill
→ Calls: run_sql dryRun=true (validated by hooks)
→ Calls: run_sql dryRun=false (after confirmation)
→ Writes generated scripts to files and updates SQL Scripts section in MEMORY.md (via write_file).
→ Prompts user to proceed to Step 3 Code Review.

         │
         ▼
@code-review-agent (User clicks Step 3)
→ Reads MEMORY.md (via read_file) to get SQL scripts list.
→ Reads the SQL script files (via read_file) and reviews them.
→ Calls: generate_word_doc → output/code-review-*.docx
→ Updates MEMORY.md (via write_file) with findings summary.
→ Prompts user to proceed to Step 4 Unit Testing.

         │
         ▼
@unit-test-agent (User clicks Step 4)
→ Reads MEMORY.md (via read_file) to get SQL scripts list and test details.
→ Deploys and runs tests using run_unit_tests tool.
→ Calls: generate_word_doc → output/test-report-*.docx
-- Updates MEMORY.md (via write_file) with test results.
→ Prompts user to report back to orchestrator.

         │
         ▼
@e2e-orchestrator (Final Pipeline Summary)
→ Reads MEMORY.md (via read_file), notes all stages are DONE.
→ Generates final pipeline-summary-*.docx report.
→ Prints the completion message!
```


