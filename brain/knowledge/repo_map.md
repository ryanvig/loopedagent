# Repo Map

Root subsystems and their responsibilities.

## Backend (`backend/app/`)

| Folder | Purpose |
|--------|---------|
| `models/` | SQLAlchemy models (46 files) |
| `schemas/` | Pydantic request/response schemas (26 files) |
| `routes/` | FastAPI route handlers (38 files) |
| `services/` | Business logic modules |
| `utils/` | Utilities (security, helpers) |
| `middleware/` | Middleware (admin_auth, etc.) |
| `config.py` | Environment configuration |
| `database.py` | DB connection & session |

### Key Backend Files

- `main.py` - FastAPI app entry, router registration
- `config.py` - Environment variables
- `rate_limit.py` - Rate limiting logic
- `middleware/admin_auth.py` - Admin auth dependencies

## Mobile (`mobile/src/`)

| Folder | Purpose |
|--------|---------|
| `lib/api.ts` | **Monolithic API layer** - all API calls go here |
| `navigation/` | AppNavigator.tsx, RootNavigator.tsx |
| `contexts/` | AuthContext.tsx, other contexts |
| `screens/` | Screen components |
| `components/` | Shared UI components |
| `hooks/` | Custom React hooks |
| `types/` | TypeScript type definitions |
| `i18n/` | Internationalization |
| `theme/` | UI theme |

### Key Mobile Files

- `lib/api.ts` - **CRITICAL** - all backend API calls
- `contexts/AuthContext.tsx` - Auth/session handling
- `navigation/AppNavigator.tsx` - Main navigation
- `navigation/RootNavigator.tsx` - Root-level navigation

## Frontend (`frontend/app/`)

| Folder | Purpose |
|--------|---------|
| `app/` | Next.js App Router pages |
| `app/view/[token]/` | Public shareable link pages |
| `app/page.tsx` | Main landing |

## Config Files

- `backend/app/config.py` - Backend env model
- `backend/alembic.ini` - Migration config
- `mobile/eas.json` - EAS build profiles
- `frontend/next.config.ts` - Next.js config

## Key Routes (Backend API Surface)

| Domain | Route File | Purpose |
|--------|------------|---------|
| Auth | `auth.py` | Login, register, tokens |
| Users | `users.py` | User management |
| Profile | `profile.py` | User profiles |
| Portfolio | `portfolio.py` | Portfolio items |
| Posts | `posts.py` | Social posts |
| Threads | `threads.py` | Thread-style posts |
| Discover | `discover.py` | Discovery/search |
| Feed | `feed.py` | Feed generation |
| Messages | `messages.py` | DMs |
| Brands | `brands.py` | Brand profiles |
| Campaigns | `campaigns.py` | Ad campaigns |
| Admin | `admin.py` | Admin dashboard |
| Safety | `safety.py` | Moderation |
| Support | `support.py` | Support tickets |
| Shareable Links | `shareable_links.py` | Public links |
| Social Accounts | `social_accounts.py` | Connected accounts |

---

*Last updated: March 19, 2026*
