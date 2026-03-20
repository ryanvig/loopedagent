# Phase 1: Knowledge Extraction Scripts

## Overview

Create Python scripts that auto-generate knowledge files from the Looped codebase (`~/Desktop/Looped/`).

## Target Location

- **Input**: `~/Desktop/Looped/`
- **Output**: `loopedagent/brain/knowledge/`

## Required Scripts

### 1. `extract_routes.py`

Extract all FastAPI routes from `backend/app/routes/`.

**Output file**: `routes.yaml`

```yaml
routes:
  - path: /api/auth/login
    methods: [POST]
    auth: none
    file: backend/app/routes/auth.py
    handler: login

  - path: /api/admin/users
    methods: [GET]
    auth: get_current_admin
    file: backend/app/routes/admin.py
    handler: get_users
```

**Implementation hints**:

- Use FastAPI's `APIRouter` introspection
- Parse decorators like `@router.post()`, `@router.get()`, etc.
- Extract `Depends()` from handler signatures for auth info
- Handle 35+ route files in `backend/app/routes/`

### 2. `extract_models.py`

Extract all SQLAlchemy models from `backend/app/models/`.

**Output file**: `models.yaml`

```yaml
models:
  User:
    file: backend/app/models/user.py
    table: users
    fields:
      - name: id
        type: UUID
        nullable: false
      - name: email
        type: str
        nullable: false
      - name: is_active
        type: bool
        default: true
    relationships:
      - name: admin_profile
        target: AdminUser
        backref: user
      - name: influencer_profile
        target: InfluencerProfile
        backref: user
```

**Implementation hints**:

- Use SQLAlchemy's `inspect()` to get model metadata
- Walk all `.py` files in `backend/app/models/`
- Extract columns, relationships, and backrefs

### 3. `extract_schemas.py`

Extract all Pydantic schemas from `backend/app/schemas/`.

**Output file**: `schemas.yaml`

```yaml
schemas:
  UserResponse:
    file: backend/app/schemas/user.py
    fields:
      - name: id
        type: UUID
      - name: email
        type: EmailStr
      - name: full_name
        type: str | None
```

### 4. `refresh_repo_map.py`

Generate current repo structure.

**Output file**: `repo_map.yaml`

```yaml
backend:
  routes:
    - auth.py
    - admin.py
    - users.py
  models:
    - user.py
    - admin.py
  services:
    - (list files)

mobile:
  api: mobile/src/lib/api.ts
  navigation:
    - mobile/src/navigation/AppNavigator.tsx
    - mobile/src/navigation/RootNavigator.tsx
  screens:
    - (list key screens)

frontend:
  pages:
    - (list Next.js routes)
```

### 5. `detect_drift.py`

Compare current codebase to stored knowledge, report changes.

**Output**: Prints drift report to stdout

```
## Drift Detected

### New Routes
- POST /api/threads (backend/app/routes/threads.py)

### New Models
- Thread (backend/app/models/thread.py)

### Modified Files
- backend/app/routes/admin.py (auth change)
```

## Technical Requirements

- Python 3.12+ (to match Looped's backend)
- Use FastAPI introspection where possible
- Use SQLAlchemy inspection for models
- Output must be valid YAML
- Scripts must be idempotent (run multiple times safely)

## Directory Structure

```
brain/scripts/
├── extract_routes.py
├── extract_models.py
├── extract_schemas.py
├── refresh_repo_map.py
├── detect_drift.py
└── requirements.txt
```

## Run Command

```bash
cd brain/scripts
python extract_routes.py
python extract_models.py
python extract_schemas.py
python refresh_repo_map.py
python detect_drift.py
```

## Notes

- Point all scripts at `~/Desktop/Looped/` as input
- Output YAML files to `../knowledge/` (relative to scripts/)
- Handle import errors gracefully (some models may have missing deps)
- Add docstrings explaining what each script does
