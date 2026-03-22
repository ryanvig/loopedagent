# Production Safety

## Required GitHub Secrets

The production workflows and rollback tooling require these GitHub secrets to be configured:

- `RAILWAY_API_TOKEN`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_SERVICE_ID`
- `RAILWAY_DEPLOYMENT_ID`

## Railway Rollback Notes

- `RAILWAY_API_TOKEN` must be used instead of the older `RAILWAY_TOKEN` name.
- `RAILWAY_DEPLOYMENT_ID` must be used instead of `RAILWAY_ENVIRONMENT_ID` for rollback targeting.
- `RAILWAY_DRY_RUN=true` will log the rollback request without calling the Railway API.
