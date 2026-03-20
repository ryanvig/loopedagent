# Verified Admin Auth Audit

**Status**: Manual audit COMPLETED - March 19, 2026

This is verified ground truth - not static inference.

## Auth Chain

Admin routes use:
1. `get_current_admin` - verifies user has active admin_profile
2. `require_super_admin` - super-admin only
3. `require_permission(...)` - granular permission checks

**Important**: No separate admin JWT - uses ordinary user tokens.

---

## Route Inventory

| Method | Path | Protection | Status |
|--------|------|------------|--------|
| POST | /api/admin/login | None (public) | ✅ By design |
| GET | /api/admin/me | get_current_admin | ✅ Protected |
| POST | /api/admin/invite | require_super_admin | ✅ Protected |
| GET | /api/admin/invitations | require_super_admin | ✅ Protected |
| POST | /api/admin/accept-invitation/{token} | **NONE** | 🔴 CRITICAL GAP |
| GET | /api/admin/admins | require_super_admin | ✅ Protected |
| PUT | /api/admin/admins/{id}/permissions | require_super_admin | ✅ Protected |
| DELETE | /api/admin/admins/{id} | require_super_admin | ✅ Protected |
| DELETE | /api/admin/invitations/{id} | require_super_admin | ✅ Protected |
| GET | /api/admin/dashboard | get_current_admin | ⚠️ Any admin |
| GET | /api/admin/tickets | get_current_admin | ⚠️ Any admin |
| PATCH | /api/admin/tickets/{id}/assign | get_current_admin | ⚠️ Any admin |
| POST | /api/admin/tickets/{id}/reply | get_current_admin | ⚠️ Any admin |
| PATCH | /api/admin/tickets/{id}/resolve | get_current_admin | ⚠️ Any admin |
| GET | /api/admin/reports | require_permission(can_moderate_content) | ✅ Protected |
| POST | /api/admin/reports/{id}/action | require_permission(can_moderate_content) | ✅ Protected |
| GET | /api/admin/campaigns/pending | require_permission(can_approve_campaigns) | ✅ Protected |
| POST | /api/admin/campaigns/{id}/review | require_permission(can_approve_campaigns) | ✅ Protected |
| GET | /api/admin/users | get_current_admin | ⚠️ Any admin |
| GET | /api/admin/users/{id} | get_current_admin | ⚠️ Any admin |
| POST | /api/admin/users/{id}/suspend | require_permission(can_suspend_users) | ✅ Protected |
| POST | /api/admin/users/{id}/unsuspend | require_permission(can_suspend_users) | ✅ Protected |
| POST | /api/admin/users/{id}/ban | require_permission(can_ban_users) | ✅ Protected |
| POST | /api/admin/users/{id}/unban | require_super_admin | ✅ Protected |
| GET | /api/admin/audit-log | require_super_admin | ✅ Protected |

---

## Findings

### 🔴 Critical: Invitation Acceptance Unauthenticated

**File**: `backend/app/routes/admin.py:308`

- No auth dependency on `POST /api/admin/accept-invitation/{token}`
- Anyone with valid token can accept without being logged in
- **Fix required**: Add `get_current_user` dependency, verify email match

### ⚠️ High: Broad Access Under get_current_admin

Routes using only `get_current_admin` (any active admin):
- Dashboard
- User search/list
- User details

This is broader than SUPPORT_AGENT role implies.

### ⚠️ Medium: Duplicate GET /me

Two handlers at lines 185 and 430 - needs consolidation.

---

## Trust Statement

> `backend/app/routes/admin.py` is mostly protected by explicit admin dependencies, but contains at least one verified authorization gap (invitation acceptance). Do NOT use as flawless security precedent until the critical bug is fixed.

---

## Required Fixes Before Trust

1. Fix `accept-invitation` endpoint - add authentication
2. Remove duplicate GET /me route
3. Decide if support agents should access dashboard/user data
