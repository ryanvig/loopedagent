# Repo Map

Root subsystems and their responsibilities.

## Backend (`backend/app/`)

| Folder | Purpose |
|--------|---------|
| `models/` | SQLAlchemy models |
| `schemas/` | Pydantic request/response schemas |
| `routes/` | FastAPI route handlers |
| `services/` | Business logic |
| `utils/` | Utilities (security, helpers) |
| `config.py` | Environment configuration |

## Mobile (`mobile/src/`)

| Folder | Purpose |
|--------|---------|
| `lib/api.ts` | Monolithic API layer |
| `navigation/` | Custom navigation (AppNavigator, RootNavigator) |
| `contexts/` | React Context providers |
| `screens/` | Screen components |
| `components/` | Shared UI components |

## Frontend (`frontend/app/`)

| Folder | Purpose |
|--------|---------|
| `app/` | Next.js App Router pages |
| `view/[token]/` | Public shareable link pages |

## Config Files

- `backend/app/config.py` - Backend env model
- `backend/alembic.ini` - Migration config
- `mobile/eas.json` - EAS build profiles
- `frontend/next.config.ts` - Next.js config

---

*To be populated by Phase 1 knowledge extraction*
