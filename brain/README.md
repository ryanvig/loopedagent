# Looped Agent Brain

Autonomous codebase-aware development system for Looped.

## Structure

```
brain/
├── knowledge/     # Canonical repo knowledge (injected into every session)
├── prompts/       # System prompts for 4 roles
├── playbooks/     # Operational playbooks
└── scripts/       # Knowledge extraction & drift detection
```

## Roles

1. **Architect** — Turns requests into implementation plans
2. **Builder** — Implements code across backend/mobile/frontend
3. **Reviewer** — Reviews changes against Looped conventions
4. **Monitor** — Detects knowledge drift and production issues

## Phase Status

- [ ] Phase 0: Admin-auth audit (blocked - requires main Looped codebase)
- [ ] Phase 1: Knowledge extraction
- [ ] Phase 2: Role prompts
- [ ] Phase 3: Playbooks
- [ ] Phase 4: Drift detection
- [ ] Phase 5: Workflow orchestration
- [ ] Phase 6: Validation harness

## Definition of Done

Brain is ready when it can:

1. Identify impacted backend/mobile/frontend files for any feature request
2. Distinguish PortfolioItem vs Post vs Thread vs Insight
3. Classify route auth correctly
4. Flag migration requirements
5. Know mobile API lives in `mobile/src/lib/api.ts`
6. Respect custom navigation architecture
7. Escalate auth/safety/admin changes
8. Produce plans citing real files
9. Catch contract mismatches in reviews
10. Detect stale knowledge

## Dependencies

Requires access to main Looped codebase:

- `backend/app/` - FastAPI routes, models, schemas
- `mobile/src/` - Expo React Native app
- `frontend/app/` - Next.js public web
