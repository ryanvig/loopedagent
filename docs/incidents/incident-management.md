# Incident Management

## Severity Levels

| Level | Description | Examples | Response Time | Communication |
|-------|-------------|----------|---------------|---------------|
| **P0** | Critical - Service down | Database unavailable, complete outage | Immediate | Page on-call, Slack #incidents |
| **P1** | High - Major feature broken | Shareable links not working, auth failing | 15 min | Slack #incidents, notify lead |
| **P2** | Medium - Degradation | Slow responses, intermittent errors | 1 hour | Track in GitHub Issues |
| **P3** | Low - Minor issue | UI glitches, non-blocking bugs | 24 hours | Schedule in next sprint |

## Incident Response Process

### 1. Detection
- **Automated**: Sentry alerts, Railway health checks, GitHub Actions failures
- **Manual**: User reports, code review发现问题

### 2. Assessment
1. Confirm the issue is real
2. Determine severity level
3. Identify affected users/systems
4. Assign incident owner

### 3. Mitigation
- **Immediate**: Rollback, feature flag off, cache flush
- **Short-term**: Hotfix deployment
- **Long-term**: Root cause fix

### 4. Resolution
- Verify fix works
- Confirm monitoring shows normal metrics
- Update stakeholders

### 5. Post-Mortem
- Document within 24 hours (P0/P1) or 1 week (P2/P3)
- Share in #incidents channel
- Create action items to prevent recurrence

## Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

**Date:** [YYYY-MM-DD]
**Severity:** [P0/P1/P2/P3]
**Duration:** [e.g., 45 minutes]
**Author:** [Name]

## Summary
[Brief description of what happened]

## Impact
- Users affected: [number/percentage]
- Duration: [start to end time]
- Revenue/feature impact: [if applicable]

## Root Cause
[Technical explanation of why it happened]

## Resolution
[How it was fixed]

## Action Items
- [ ] [Action] - @owner - Due [date]
- [ ] [Action] - @owner - Due [date]

## Lessons Learned
[What went well, what went wrong]
```

## On-Call Rotation

### Primary On-Call
- First responder to alerts
- Must acknowledge P0/P1 within 5 minutes

### Secondary On-Call
- Backup if primary is unavailable
- Escalation point for P0/P1

### Handoff
- Document current incidents
- Review pending changes
- Confirm access to all systems

## Contact Info

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | [Name] | [Phone/Slack] |
| Secondary On-Call | [Name] | [Phone/Slack] |
| Engineering Lead | Ryan | @ryan |

## Escalation Path

```
P3 (Low)
  ↓
P2 (Medium) → Engineering Lead
  ↓
P1 (High) → Engineering Lead + CTO
  ↓
P0 (Critical) → All hands → CEO
```
