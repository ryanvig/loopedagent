# Production Safety

## Required GitHub Secrets

The production workflows and rollback tooling require these GitHub secrets to be configured:

- `RAILWAY_API_TOKEN`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_SERVICE_ID`
- `RAILWAY_DEPLOYMENT_ID`

## Agent Infrastructure

The agent-monitoring and backlog-advancement features require these environment
variables and secrets:

- `CONVEX_URL` — Convex deployment URL from the Mission Control app
- `GITHUB_WEBHOOK_SECRET` — secret for verifying GitHub webhook payloads
- `GITHUB_TOKEN` — used for backlog advancement, GitHub Actions polling, and PR metadata sync
- `SLACK_DESIGN_REVIEW_WEBHOOK_URL` — incoming webhook used for Design Agent review notifications and acknowledgements

## Slack Design Review Loop

To complete the Design Agent review-selection loop, configure the Slack app
Events API with:

- Request URL: `https://loopedagent-production.up.railway.app/webhooks/slack-design-review`
- Subscribe to bot events: `message.channels`
- Invite the loopedagent app to the `#design-review` channel

The Looped GitHub Actions workflow posts the review prompt to Slack and
registers the pending review with loopedagent. Replies in `#design-review`
using `1/2/3` or `A/B/C` are translated into a `build:ready` GitHub issue for
the selected variant.

## Railway Rollback Notes

- `RAILWAY_API_TOKEN` must be used instead of the older `RAILWAY_TOKEN` name.
- `RAILWAY_DEPLOYMENT_ID` must be used instead of `RAILWAY_ENVIRONMENT_ID` for rollback targeting.
- `RAILWAY_DRY_RUN=true` will log the rollback request without calling the Railway API.
