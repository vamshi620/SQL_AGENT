---
description: Generates a complete set of unit test stored procedures for a given
  stored procedure or table, covering all standard test scenarios from the sql-test-patterns skill.
mode: agent
model: gpt-4o
---

# Generate Unit Tests

Generate a complete unit test suite for: **${input:object_name:Enter stored procedure or table name}**

## Instructions

1. Call `get_db_schema` to fetch schema for the relevant tables
2. Apply the `sql-test-patterns` skill to determine which test cases to create
3. Generate test stored procedures covering:
   - ✅ Happy path
   - ❌ NULL inputs for each required parameter  
   - 🔲 Duplicate/unique constraint violations (if applicable)
   - 🔲 Foreign key violations
   - 🔲 Boundary values (min/max lengths, zero amounts)
   - 🔲 Soft-delete / IsDeleted handling
   - 🔲 Transaction rollback on failure
4. Output all test procedures as a single SQL script with GO separators
5. Ask: "Shall I deploy and run these tests now with `@unit-test-agent`?"

## Output Format
- One stored procedure per test case
- Naming: `usp_Test_<Suite>_<Scenario>`
- Use negative test IDs (`-99999`, `-99998`, etc.)
- Include pre-cleanup and post-cleanup DELETE statements
- Return standard `(Status, ErrorMessage, Expected, Actual)` result set
