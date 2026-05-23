---
name: agent-handoff
description: >
  Use when you need to pass context from one agent to another in a sequential
  workflow. Defines the handoff protocol — what information each agent produces
  and what the next agent expects to receive. Use at the END of an agent's work
  to prepare a clean summary for the next agent in the pipeline.
---

# Agent Handoff Skill

## The E2E Pipeline

```
@requirements-agent  →  @sql-impl-agent  →  @code-review-agent  →  @unit-test-agent
```

---

## Handoff 1: Requirements → SQL Implementation

After completing a requirements document, the `@requirements-agent` should produce
a **Handoff Summary** formatted as follows. This summary becomes the INPUT to `@sql-impl-agent`.

### Requirements Handoff Format
```markdown
## ✅ Requirements Complete — Handoff to @sql-impl-agent

**Requirements Doc:** output/requirements-<feature>-<date>.docx

**Entities to Create/Modify:**
| Entity (Table) | Action | Key Columns | Constraints |
|---|---|---|---|
| Customers | MODIFY | LoyaltyPoints INT | DEFAULT 0, NOT NULL |
| LoyaltyTransactions | CREATE | CustomerId, Points, TransactionType | FK → Customers |

**Stored Procedures Needed:**
1. `usp_Customer_AddLoyaltyPoints` – adds points on order completion
2. `usp_Customer_RedeemPoints` – deducts points and validates balance
3. `usp_Customer_GetLoyaltyBalance` – returns current balance for a customer

**Business Rules to Encode:**
- Points cannot go below 0
- Redemption requires minimum 100 points
- 1 point earned per $1 spent (rounded down)

**Key Acceptance Criteria:**
- FR-001: Points added immediately on order status = 'Completed'
- FR-002: Failed redemption returns error code 50100
```

---

## Handoff 2: SQL Implementation → Code Review

After completing SQL scripts, the `@sql-impl-agent` should produce:

### SQL Implementation Handoff Format
```markdown
## ✅ SQL Implementation Complete — Handoff to @code-review-agent

**Scripts Created:**
- sql/001_LoyaltyTransactions_Create.sql
- sql/002_Customer_AlterAddLoyaltyPoints.sql
- sql/003_usp_Customer_AddLoyaltyPoints.sql
- sql/004_usp_Customer_RedeemPoints.sql
- sql/005_usp_Customer_GetLoyaltyBalance.sql

**Objects to Review:**
| Object | Type | Complexity | Risk |
|---|---|---|---|
| usp_Customer_AddLoyaltyPoints | Stored Proc | Medium | Low |
| usp_Customer_RedeemPoints | Stored Proc | High | HIGH – deducts balance |
| LoyaltyTransactions | Table | Low | Low |

**Focus Areas for Review:**
- Concurrency safety on `usp_Customer_RedeemPoints` (race condition risk)
- Parameter validation for negative point values
- Index coverage for CustomerId lookups

**Deployment Status:** ✅ Dry-run validated | ✅ Executed on dev DB
```

---

## Handoff 3: Code Review → Unit Testing

After completing a code review, the `@code-review-agent` should produce:

### Code Review Handoff Format
```markdown
## ✅ Code Review Complete — Handoff to @unit-test-agent

**Review Report:** output/code-review-<object>-<date>.docx
**Quality Score:** 82/100
**Recommendation:** Request Changes (1 major issue to fix before testing)

**Critical Issues (Fix First):**
- None

**Major Issues (Address Before Test):**
1. Missing ROWLOCK hint on `usp_Customer_RedeemPoints` — race condition risk
   Fix: Add `WITH (ROWLOCK, UPDLOCK)` on the SELECT inside the transaction

**Test Focus — High Risk Areas:**
1. `usp_Customer_RedeemPoints` – concurrent redemptions, zero-balance guard
2. `usp_Customer_AddLoyaltyPoints` – ordering of operations under load

**Suggested Test Cases to Cover:**
- Concurrent double-redemption (race condition test)
- Redeem with exactly 100 points (boundary)
- Redeem with 99 points (should fail)
- Add points to non-existent customer (FK check)
```

---

## Handoff 4: Unit Testing → Final Summary

After testing completes, the `@unit-test-agent` produces a final status:

### Test Results Handoff Format
```markdown
## ✅ Testing Complete — E2E Pipeline Summary

**Test Report:** output/test-report-<feature>-<date>.docx

| Stage | Status | Output |
|---|---|---|
| Requirements | ✅ Complete | requirements-<feature>-<date>.docx |
| SQL Implementation | ✅ Deployed | 5 scripts, 0 errors |
| Code Review | ⚠️ 1 Major Issue Fixed | code-review-<object>-<date>.docx |
| Unit Tests | ✅ 12/12 Passed | test-report-<feature>-<date>.docx |

**Production Ready:** ✅ Yes — all tests passing, no critical issues
```
