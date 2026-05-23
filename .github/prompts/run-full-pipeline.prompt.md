---
description: Quick-start prompt for the full E2E pipeline. Run requirements analysis,
  SQL implementation, code review, and unit tests in sequence for a feature.
mode: agent
model: gpt-4o
---

# E2E Pipeline — Full Feature Development

Run the complete E2E pipeline for: **${input:feature_description:Describe the feature to build}**

## Step 1: Requirements
Use `@requirements-agent` to:
1. Fetch live DB schema
2. Analyze requirements
3. Save requirements Word document

## Step 2: SQL Implementation  
Use `@sql-impl-agent` to:
1. Read the requirements from Step 1
2. Generate SQL DDL + stored procedures
3. Dry-run validate
4. Execute on confirmation

## Step 3: Code Review
Use `@code-review-agent` to:
1. Review all SQL generated in Step 2
2. Flag critical, major, minor issues
3. Save code review Word document

## Step 4: Unit Testing
Use `@unit-test-agent` to:
1. Deploy the SQL from Step 2
2. Generate and run test procedures
3. Save test report Word document

## Final Output Summary
Produce a pipeline summary table showing all 4 stages, their status, and output file paths.
