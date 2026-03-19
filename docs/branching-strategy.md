# Branching Strategy

## Overview

This document outlines the branching strategy for the Looped Agent infrastructure repo.

## Branch Types

| Branch      | Purpose                  | Base    | Merges To |
| ----------- | ------------------------ | ------- | --------- |
| `main`      | Production-ready code    | -       | -         |
| `develop`   | Integration branch       | main    | main      |
| `feature/*` | New features             | develop | develop   |
| `fix/*`     | Bug fixes                | develop | develop   |
| `chore/*`   | Maintenance, refactoring | develop | develop   |

## Workflow

```
feature/* → develop → main → Deploy
     ↑          ↑
     └──────────┘ (backport if needed)
```

## Naming Conventions

- Features: `feature/add-codeql-scanning`
- Fixes: `fix/auth-endpoint-rate-limit`
- Chores: `chore/update-dependencies`

## Rules

1. **Never commit directly to `main`**
2. **All changes go through PR**
3. **PRs require 1 approval** (can be self-approved for chore updates)
4. **Keep branches small** — squash merge when possible
5. **Delete branches after merge**

## Release Tags

- Format: `v1.0.0`
- Created from `main` after QA sign-off
