# Conventions

Looped's established coding patterns.

## Backend Conventions

### Model/Schema/Route Triad

Every feature domain should have:

1. `models/[domain].py` - SQLAlchemy model
2. `schemas/[domain].py` - Pydantic schemas (Request/Response)
3. `routes/[domain].py` - FastAPI route handlers

### Auth Pattern

- Use `get_current_user` for authenticated endpoints
- Use `get_current_user_optional` for public endpoints with optional auth
- Admin endpoints use `get_current_admin` or permission dependencies

### Migration Rules

- Always use additive migrations
- Never drop columns/tables without approval
- Use Alembic for migrations

## Mobile Conventions

### API Layer (CRITICAL)

- ALL API calls MUST go through `mobile/src/lib/api.ts`
- Do NOT create separate API modules
- Add new endpoints as functions in api.ts

### Auth

- Session handling in `mobile/src/contexts/AuthContext.tsx`
- Token refresh handled automatically

### Navigation

- Custom navigation in `mobile/src/navigation/`
- Use AppNavigator and RootNavigator patterns

## Frontend Conventions

### Public Pages

- Shareable links in `frontend/app/view/[token]/`
- Minimal client - relies on backend API

## Anti-Patterns

1. **Don't create parallel API modules** - Use `mobile/src/lib/api.ts`
2. **Don't skip migrations** - Always add migration for schema changes
3. **Don't mix auth levels** - Be explicit about protected vs public
4. **Don't bypass navigation** - Use existing navigation patterns
5. **Don't reuse wrong content domain** - PortfolioItem ≠ Post ≠ Thread

## Naming

- Routes: `snake_case` (e.g., `shareable_links.py`)
- Models: `PascalCase` (e.g., `ShareableLink`)
- Schemas: `PascalCase` (e.g., `ShareableLinkResponse`)
- Mobile: `camelCase` / `PascalCase` (TypeScript)
