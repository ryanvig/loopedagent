# Playbook: Implement New Feature End-to-End

## When to Use

Building a new feature that spans backend + mobile + frontend.

## Steps

### 1. Gather Context
- [ ] Read any existing PRD/implementation plan
- [ ] Identify affected backend domain
- [ ] Identify mobile consumers
- [ ] Check if public web affected

### 2. Backend Implementation
- [ ] Add/update model in `backend/app/models/`
- [ ] Add/update schema in `backend/app/schemas/`
- [ ] Add/update route in `backend/app/routes/`
- [ ] Add migration in `backend/alembic/versions/`
- [ ] Add/update tests

### 3. Mobile Implementation
- [ ] Update TS interface in `mobile/src/lib/api.ts`
- [ ] Add wrapper function if needed
- [ ] Update consuming screen/component
- [ ] Update navigation if flow changed

### 4. Frontend Implementation
- [ ] Update public web if affected
- [ ] Verify shareable link contract

### 5. Verify
- [ ] Tests pass
- [ ] No contract mismatches
- [ ] Migration is safe

### 6. Knowledge Update (if needed)
- [ ] Update repo map if structure changed
- [ ] Update conventions if new pattern emerged
- [ ] Update risk map if blast radius changed

## Anti-Patterns to Avoid

- Creating parallel API access patterns (use `mobile/src/lib/api.ts`)
- Destructive migrations without approval
- Skipping mobile or frontend when backend changes
