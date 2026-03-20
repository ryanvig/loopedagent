# Playbook: Handle Security Scan Failure

## When to Use

CI/CD security scan (CodeQL, npm audit, dependabot) reports a vulnerability.

## Steps

### 1. Identify Subsystem

- [ ] Auth (token, session, password)
- [ ] Dependency (third-party library)
- [ ] Public endpoint (unauthenticated access)
- [ ] Secret/config exposure
- [ ] Input validation

### 2. Inspect Relevant Files

- Auth issues → `backend/app/utils/security.py`, route auth deps
- Dependency issues → `package.json`, `requirements.txt`
- Public endpoint → route handlers, middleware
- Secrets → env files, config

### 3. Classify Issue

- [ ] Real vulnerability
- [ ] Stale config/finding
- [ ] False positive

### 4. Fix (if real)

- [ ] Fix in canonical layer (not band-aid)
- [ ] Add/update tests
- [ ] Update knowledge layer if new rule discovered

### 5. Verify

- [ ] Re-run security scan
- [ ] Confirm no regression

## High-Risk Escalation

Escalate immediately if:

- Auth/session vulnerability
- Data exposure
- Privilege escalation possible
- Dependency is actively malicious

## Common Fixes

| Issue               | Fix                                       |
| ------------------- | ----------------------------------------- |
| Outdated dependency | `npm update` or `pip update`              |
| XSS                 | Sanitize input, use framework protections |
| IDOR                | Add ownership checks                      |
| SQL injection       | Use ORM, parameterized queries            |
| Secret leak         | Remove from code, rotate secret           |
