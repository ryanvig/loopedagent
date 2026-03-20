# Monitoring & Incident Response

## Overview

This document covers the monitoring stack, alerting, and auto-rollback procedures for Looped Agent.

## Monitoring Stack

| Tool           | Purpose                                |
| -------------- | -------------------------------------- |
| Sentry         | Error tracking, performance monitoring |
| GitHub Actions | Deployment status                      |
| Railway        | Runtime health, metrics                |

## Sentry Integration

### Setup

```bash
# Install Sentry SDK
npm install @sentry/node

# Set environment variable
export SENTRY_DSN="https://xxx@sentry.io/xxx"
```

### Usage

```typescript
import { initSentry, captureError } from './sentry';

// Initialize at app startup
initSentry();

// Capture errors
try {
  // your code
} catch (error) {
  captureError(error, { context: 'user_action' });
}
```

## Auto-Rollback Procedure

### Trigger Conditions

- **Error Rate**: > 5% errors in 15-minute window
- **Latency**: P99 latency > 2 seconds for 5 minutes
- **Health Check**: > 2 consecutive failures

### Rollback Process

1. **Alert Fired** → On-call engineer paged
2. **Verification** → Confirm error is production-breaking
3. **Rollback** → Click "Revert" in Railway dashboard OR:
   ```bash
   git revert HEAD
   git push origin main
   ```
4. **Verify** → Confirm error rate drops
5. **Post-Mortem** → Document within 24 hours

### Railway Auto-Deploy Hook

Configure in Railway dashboard:

1. Go to Project → Settings → Deploy
2. Enable "Automatic Rollbacks"
3. Set health check endpoint
4. Configure timeout (default: 60s)

## Smoke Tests

Critical flows that must pass before production deployment:

### 1. Agent Initialization

```typescript
it('should initialize agent with config', () => {
  const agent = initializeAgent({
    name: 'test',
    model: 'gpt-4',
    maxTokens: 1000,
  });
  expect(agent).toBeDefined();
});
```

### 2. Task Processing

```typescript
it('should process valid task', () => {
  const task = { id: '1', title: 'Test', status: 'pending', priority: 'high' };
  const result = processTask(task);
  expect(result.status).toBe('done');
});
```

### 3. Rate Limiter Config

```typescript
it('should apply rate limits', () => {
  const limiter = shareableLinkLimiter;
  expect(limiter.max).toBe(30);
});
```

### Running Smoke Tests

```bash
# Run all tests
npm test

# Run specific smoke test
npm test -- --testPathPattern="smoke"
```

## Alert Severity Levels

| Level | Description                 | Response Time |
| ----- | --------------------------- | ------------- |
| P0    | Critical - Service down     | Immediate     |
| P1    | High - Major feature broken | 15 min        |
| P2    | Medium - Degradation        | 1 hour        |
| P3    | Low - Minor issue           | 24 hours      |

## On-Call Rotation

- Weekly rotation via PagerDuty or similar
- Primary + secondary on-call
- Handoff documented in #incidents Slack channel
