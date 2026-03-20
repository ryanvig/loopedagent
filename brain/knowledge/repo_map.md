# Repo Map

Root subsystems and their responsibilities.

## Backend (`backend/app/`)

| Folder/File | Purpose |
|-------------|---------|
| `models/` | SQLAlchemy models (user, admin, support, campaign, etc.) |
| `schemas/` | Pydantic request/response schemas |
| `routes/` | FastAPI route handlers (35+ route files) |
| `services/` | Business logic |
| `middleware/` | Auth middleware including `admin_auth.py` |
| `utils/security.py` | JWT, password hashing, auth utilities |
| `config.py` | Environment configuration |
| `database.py` | DB connection |
| `rate_limit.py` | Rate limiting |

### Key Route Files

- `auth.py` - Login, register, refresh token
- `admin.py` - Admin dashboard (AUDIT COMPLETE)
- `users.py` - User management
- `profile.py` - User profiles
- `portfolio.py` - Portfolio items
- `posts.py` - Posts
- `threads.py` - Threads
- `discover.py` / `feed.py` - Discovery/feed
- `messages.py` - Messaging
- `notifications.py` - Notifications
- `shareable_links.py` - Public shareable links
- `brands.py` / `campaigns.py` - Brand deals
- `safety.py` / `support.py` - Moderation

---

## Mobile (`mobile/src/`)

| Folder/File | Purpose |
|-------------|---------|
| `lib/api.ts` | **MONOLITHIC API LAYER** - all API calls |
| `navigation/` | Custom navigation (AppNavigator, RootNavigator) |
| `contexts/` | React Context providers (Auth, etc.) |
| `screens/` | Screen components |
| `components/` | Shared UI components |

---

## Frontend (`frontend/app/`)

| Folder | Purpose |
|--------|---------|
| `app/` | Next.js App Router pages |
| `view/[token]/` | Public shareable link pages |

---

## Config Files

- `backend/app/config.py` - Backend env model
- `backend/alembic.ini` - Migration config
- `mobile/eas.json` - EAS build profiles
- `frontend/next.config.ts` - Next.js config
