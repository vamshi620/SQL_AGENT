---
name: sql-tsql-standards
description: >
  Use when writing, reviewing, or generating any T-SQL code (stored procedures,
  tables, views, functions, indexes). Enforces SQL Server coding standards,
  naming conventions, security patterns, and performance best practices.
---

# T-SQL Coding Standards – Skill

## Naming Conventions

### Tables
- PascalCase, plural: `Customers`, `OrderItems`, `ProductCategories`
- Bridge/junction tables: `CustomerProducts`, `UserRoles`
- Always include audit columns: `CreatedAt DATETIME2(7)`, `UpdatedAt DATETIME2(7)`, `IsDeleted BIT`

### Columns
- PascalCase: `CustomerId`, `FirstName`, `OrderDate`
- Primary keys: `<TableName>Id` (e.g., `CustomerId`, `OrderId`)
- Foreign keys: `<ReferencedTable>Id` (e.g., `CustomerId`)  
- Bit flags: prefix with `Is` or `Has` → `IsActive`, `HasInvoice`
- Date-only columns: suffix `Date` → `OrderDate`, `DeliveryDate`
- DateTime columns: suffix `At` → `CreatedAt`, `ProcessedAt`

### Stored Procedures
- Pattern: `[dbo].[usp_<Entity>_<Action>]`
- Examples: `usp_Customer_Insert`, `usp_Order_GetById`, `usp_OrderItem_Delete`

### Indexes
- Primary key: `PK_<TableName>`
- Unique: `UQ_<TableName>_<Column>`
- Non-clustered: `IX_<TableName>_<Column(s)>`
- Foreign key: `FK_<Table>_<ReferencedTable>`

---

## Data Type Rules

| Scenario | Use This | Never Use This |
|---|---|---|
| Text (any) | `NVARCHAR(n)` or `NVARCHAR(MAX)` | `VARCHAR`, `TEXT` |
| Date+Time | `DATETIME2(7)` | `DATETIME`, `SMALLDATETIME` |
| Date only | `DATE` | `DATETIME` |
| Money | `DECIMAL(18,4)` | `MONEY`, `FLOAT` |
| True/False | `BIT NOT NULL DEFAULT 0` | `INT` with 0/1 |
| ID / Key | `INT IDENTITY(1,1)` or `BIGINT` | `UNIQUEIDENTIFIER` (unless distributed) |
| Audit user | `NVARCHAR(256)` | `INT` FK |

---

## Stored Procedure Template

```sql
CREATE OR ALTER PROCEDURE [dbo].[usp_Entity_Action]
    @Param1 INT,
    @Param2 NVARCHAR(255) = NULL   -- Optional params have defaults
AS
BEGIN
    SET NOCOUNT ON;       -- Suppress "N rows affected" messages
    SET XACT_ABORT ON;    -- Auto-rollback entire transaction on any error

    -- Input validation
    IF @Param1 IS NULL OR @Param1 <= 0
        THROW 50001, 'Param1 must be a positive integer.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Business logic here

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;   -- Re-throw to caller
    END CATCH
END
GO
```

---

## Security Rules (Mandatory)

1. **Never** use dynamic SQL with string concatenation — always use `sp_executesql` with parameters
2. **Never** use `EXECUTE AS OWNER` unless absolutely required and reviewed
3. **Always** validate foreign key IDs exist before inserting
4. **Always** use parameterized queries (never embed user input in SQL strings)
5. **Grant EXECUTE** on stored procs only — never grant SELECT/INSERT/UPDATE/DELETE on tables directly

### Safe Dynamic SQL Pattern
```sql
-- ✅ SAFE: Parameterized dynamic SQL
DECLARE @sql NVARCHAR(MAX) = N'SELECT * FROM [dbo].[Customers] WHERE CustomerId = @Id';
EXEC sp_executesql @sql, N'@Id INT', @Id = @inputId;

-- ❌ DANGEROUS: String concatenation
DECLARE @sql2 NVARCHAR(MAX) = 'SELECT * FROM Customers WHERE CustomerId = ' + @inputId;
EXEC(@sql2);
```

---

## Performance Rules

1. **Index foreign keys** — always add a non-clustered index on every FK column
2. **Avoid SELECT *** — always specify column names explicitly
3. **Avoid functions on indexed columns** in WHERE clauses (non-SARGable)
   ```sql
   -- ❌ Bad: full table scan
   WHERE YEAR(OrderDate) = 2024
   -- ✅ Good: index seek
   WHERE OrderDate >= '2024-01-01' AND OrderDate < '2025-01-01'
   ```
4. **Use `EXISTS` not `COUNT(*)`** for existence checks
5. **Avoid cursors** — prefer set-based operations. If unavoidable, use `FAST_FORWARD`
6. **Add `NOLOCK` hints** only when stale reads are explicitly acceptable
7. **Use covering indexes** for high-frequency query patterns

---

## Transaction Rules

1. **Always wrap multi-statement DML** in explicit `BEGIN TRANSACTION`
2. **Use `SET XACT_ABORT ON`** in all stored procedures
3. **Check `@@TRANCOUNT > 0`** before rolling back in CATCH blocks
4. **Never `COMMIT` in a CATCH block**
5. **Keep transactions short** — do not include any external calls inside a transaction

---

## Comment Standards

```sql
-- ============================================================
-- Procedure : usp_Order_Create
-- Author    : SQL Impl Agent
-- Date      : 2026-05-23
-- Version   : 1.0
-- Description: Creates a new order and its line items in a
--              single atomic transaction.
-- Parameters:
--   @CustomerId INT  - ID of the customer placing the order
--   @Items      ...  - Table-valued parameter of line items
-- Returns    : @NewOrderId INT - the newly created Order ID
-- ============================================================

-- Inline comments: explain WHY, not WHAT the code does
-- Bad:  -- Insert the record
-- Good: -- Soft-insert: mark previous record as deleted before inserting new version
```
