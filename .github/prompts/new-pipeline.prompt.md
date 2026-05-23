---
description: Start a brand-new E2E development pipeline from scratch. This is the
  recommended entry point — invokes the orchestrator agent which coordinates all other agents.
mode: agent
model: gpt-4o
---

# New Feature Pipeline

Start a new E2E development pipeline for the following feature:

**Feature Request:** ${input:feature_request:Describe the feature you want to build}

## Instructions

Invoke `@e2e-orchestrator` with this request. The orchestrator will:
1. Understand your requirements
2. Fetch the live database schema
3. Initialize `MEMORY.md` as the shared pipeline state file
4. Present a 4-stage pipeline plan
5. Guide you step-by-step via action buttons

You'll then click through:
- **📋 Step 1** → Requirements Agent generates Word doc
- **🔨 Step 2** → SQL Implementation Agent writes and deploys SQL
- **🔍 Step 3** → Code Review Agent audits and scores the code
- **🧪 Step 4** → Unit Test Agent runs tests and generates report
- **📊 Final** → Orchestrator generates Pipeline Summary Word doc

> **Tip:** If you get interrupted, just type `@e2e-orchestrator show pipeline status` and it will read MEMORY.md and resume from where you left off.
