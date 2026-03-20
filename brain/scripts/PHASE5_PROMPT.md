# Phase 5: Workflow Orchestration

## Overview

Phase 5 implements how the four agent roles (Architect, Builder, Reviewer, Monitor) hand off work to each other. This is defined in the PRD under "Implementation Order" and "Four Agent Roles."

## PRD Source References

The following sections from the PRD must be implemented:

- **Section 5: Four Agent Roles** - Defines responsibilities and boundaries for each role
- **Section 7: Escalation Contract** - Defines when brain must stop and ask vs act autonomously
- **Section 9: Knowledge Layer Update Protocol** - Defines how knowledge updates flow through roles
- **Section 10.1: Playbook - Implementing a New Feature End to End** - Shows the handoff flow

## Required Outputs

Create the following files in `brain/workflows/`:

### 1. `workflow_orchestration.md`

Document the complete handoff flow from a feature request through all four roles:

```
User Request
    ↓
[ARCHITECT] → Implementation Plan
    ↓
[BUILDER] → Code Changes
    ↓
[REVIEWER] → Review Findings
    ↓
[MONITOR] → Knowledge Updates
```

Include:
- Exact inputs each role receives
- Exact outputs each role produces
- Decision points and branches
- Error/retry handling

### 2. `architect_to_builder_handoff.md`

Define what the Architect outputs that the Builder needs:
- Implementation scope
- Impacted files list
- Migration requirements
- API contract changes
- Mobile/frontend follow-on work
- Tests to add/update
- Open questions list

### 3. `builder_to_reviewer_handoff.md`

Define what the Builder outputs that the Reviewer needs:
- Code changes (diff or commit)
- Implementation plan reference
- Tests added/updated
- Any assumptions made
- Any deviations from plan

### 4. `reviewer_approval_criteria.md`

Define when Reviewer approval is required:
- Critical findings must be resolved
- High findings should be resolved or documented
- Medium findings may remain with rationale
- Knowledge updates must be flagged

### 5. `monitor_drift_update.md` (enhance existing)

Enhance the existing playbook to handle the complete drift update flow:
- Detect drift
- Propose knowledge updates
- Get confirmation (if needed)
- Commit knowledge updates

### 6. `escalation_decision_tree.md`

Create a decision tree based on the PRD escalation contract:

**Autonomous (brain can proceed):**
- Change is additive and localized
- Existing architecture clearly indicates path
- Migration is additive and non-destructive
- Mobile work is straightforward extension
- Tests can verify correctness

**Must Stop and Ask (escalate):**
- Auth/session semantics would change
- Destructive data layer change
- Ambiguous content domain (Post vs Thread vs PortfolioItem)
- Safety/moderation/admin behavior changes
- Public URL/SEO changes
- New pattern conflicts with architecture
- Multiple plausible precedents

### 7. `role_prompts_orchestration.md`

Update the existing role prompts to include:
- Who invokes this role
- What inputs to expect
- What outputs to produce
- Who to invoke next
- When to escalate

## Directory Structure

Create:
```
brain/workflows/
├── workflow_orchestration.md      # Main orchestration document
├── architect_to_builder_handoff.md
├── builder_to_reviewer_handoff.md
├── reviewer_approval_criteria.md
├── monitor_drift_update.md       # Enhanced from existing
├── escalation_decision_tree.md
└── role_prompts_orchestration.md
```

## Implementation Notes

- Use the exact terminology from the PRD (Architect, Builder, Reviewer, Monitor)
- Reference the knowledge files (routes.yaml, models.yaml, etc.) as inputs
- Include examples for each handoff
- Make it machine-readable where possible (decision trees, checklists)
- Include error handling for when a role cannot complete

## Testing the Orchestration

After implementation, document how to test:
1. Give a simple feature request through the full flow
2. Give a request that requires escalation
3. Verify knowledge updates are proposed correctly
4. Verify blocked issues format matches PRD spec

## Commit

Commit all new files with message: `feat: add Phase 5 workflow orchestration`
