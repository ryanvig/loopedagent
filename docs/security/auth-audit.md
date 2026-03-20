# Auth Audit Tests

## Overview

Security tests that verify protected endpoints reject unauthenticated requests and authorized requests have proper access controls.

## Test Patterns

### Unauthenticated Access Tests

```typescript
describe('Auth Audit', () => {
  const protectedEndpoints = [
    '/api/users',
    '/api/profile',
    '/api/settings',
    '/api/admin',
  ];

  protectedEndpoints.forEach((endpoint) => {
    it(`should reject unauthenticated requests to ${endpoint}`, async () => {
      const response = await request(app).get(endpoint);
      expect(response.status).toBe(401);
    });
  });
});
```

### Shareable Link Security (Critical)

Since unauthenticated shareable links are Looped's primary external attack surface:

```typescript
describe('Shareable Link Security', () => {
  it('should not expose creator email to public', async () => {
    const response = await request(app).get('/share/abc123');
    expect(response.body.creator.email).toBeUndefined();
  });

  it('should reject revoked shareable links', async () => {
    const response = await request(app).get('/share/revoked-token');
    expect(response.status).toBe(404);
  });

  it('should rate limit shareable link views', async () => {
    // Make 100+ requests rapidly
    const promises = Array(101)
      .fill(null)
      .map(() => request(app).get('/share/any-token'));
    const responses = await Promise.all(promises);
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Running Auth Audits

```bash
# Run auth-specific tests
npm test -- --testPathPattern="auth"

# Run in CI
npx jest --testPathPattern="auth" --coverage
```

## CI Integration

Auth audit tests run in the `security` job before deployment to staging or production.
