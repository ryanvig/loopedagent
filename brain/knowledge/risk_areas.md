# Risk Areas

High-risk domains requiring extra caution and escalation.

## 1. Authentication & Session

**Files:**
- `backend/app/routes/auth.py`
- `backend/app/utils/security.py`
- `mobile/src/contexts/AuthContext.tsx`
- `mobile/src/lib/api.ts` (auth methods)

**Why risky:**
- Token refresh, login, logout are tightly coupled
- Easy to break session recovery
- Blast radius: all users

**Escalation trigger:** Any change to token claims, refresh semantics, or protected route logic.

---

## 2. Safety, Moderation & Admin ⚠️ AUDIT COMPLETE

**Files:**
- `backend/app/routes/admin.py` - **AUDIT COMPLETE**
- `backend/app/routes/safety.py`
- `backend/app/routes/support.py`
- `backend/app/models/support.py`
- `backend/app/middleware/admin_auth.py`

**Audit Findings:**
- ✅ Most routes properly protected with `require_super_admin` or `require_permission(...)`
- 🔴 **CRITICAL**: `POST /api/admin/accept-invitation/{token}` has NO auth - anyone with token can claim it
- ⚠️ Routes using `get_current_admin` (any admin) access dashboard, user list, user details
- ⚠️ Duplicate `GET /api/admin/me` route needs cleanup

**Special note:** Do NOT treat admin.py as flawless security precedent until critical invitation bug is fixed.

**Escalation trigger:** Any change to admin routes, invitation flow.

---

## 3. Discover/Feed Ranking

**Files:**
- `backend/app/routes/discover.py`
- `backend/app/routes/feed.py`
- `backend/app/services/discovery_engine.py`
- `mobile/src/screens/HomeScreen.tsx`

**Why risky:**
- Highly user-visible
- Easy to regress performance/personalization
- Analytics coupling

**Escalation trigger:** Any change to ranking logic, feed algorithm, or personalization.

---

## 4. Messaging

**Files:**
- `backend/app/routes/messages.py`
- `mobile/src/screens/MessagesScreen.tsx`
- `mobile/src/lib/messageMappers.ts`

**Why risky:**
- Stateful UX (read/unread/archive/mute)
- Notification dependencies

**Escalation trigger:** Any change to message state or delivery semantics.

---

## 5. Public Web Contracts

**Files:**
- `backend/app/routes/shareable_links.py`
- `backend/app/routes/profile.py`
- `frontend/app/view/[token]/`

**Why risky:**
- Same data across app and public web
- Easy to create contract mismatches

**Escalation trigger:** Any change to shareable link or public profile data shape.
