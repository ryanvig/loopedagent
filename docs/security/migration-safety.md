# Migration Safety Guidelines

## Overview

This document outlines safety checks for database migrations to prevent accidental data loss or service disruption.

## Danger Classifications

### 🔴 Destructive Operations (Require Human Sign-off)

| Operation | Risk | Required Action |
|-----------|------|-----------------|
| `DROP COLUMN` | Data loss | Human review + backup verification |
| `DROP TABLE` | Complete data loss | Never auto-apply; manual review |
| `ALTER TYPE` (changing enum values) | Runtime errors | Human review |
| `REMOVE INDEX` | Performance degradation | Human review |
| `TRUNCATE` | Data loss | Never auto-apply |

### 🟡 Large Table Operations (Require Sign-off)

| Condition | Threshold | Required Action |
|-----------|-----------|-----------------|
| Table row count | > 10,000 rows | Human sign-off |
| Table size | > 100MB | Human sign-off |
| Estimated migration time | > 30 seconds | Human review |

### 🟢 Safe Operations (Auto-apply OK)

| Operation | Notes |
|-----------|-------|
| `ADD COLUMN` | With default value |
| `ADD INDEX` | Non-blocking |
| `CREATE TABLE` | New tables are safe |
| `RENAME COLUMN` | If backwards compatible |

## Pre-Deployment Checklist

- [ ] Backup created and verified
- [ ] Migration tested on staging with similar data volume
- [ ] Rollback plan documented
- [ ] Maintenance window communicated (if needed)
- [ ] DBA/Lead engineer approval for destructive changes

## Rollback Procedures

1. Stop incoming traffic (maintenance mode)
2. Restore from backup
3. Verify data integrity
4. Resume traffic
5. Post-mortem within 24 hours

## CI Integration

For Looped's backend (FastAPI/SQLAlchemy), migrations are checked during PR review. Any migration file containing:
- `drop_column`
- `drop_table`
- `alter_type`

...must include a `[requires-review]` label and approval from a senior engineer.
