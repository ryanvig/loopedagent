import crypto from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';

import {
  type DeployEnvironment,
  getProductionStabilityWindowStatus,
  recordDeploy,
} from './deployState';
import { rollbackDeployment } from './railway';

const DEFAULT_PORT = 3000;
const DEFAULT_ERROR_RATE_THRESHOLD = 0.05;
const DEPLOY_SECRET_HEADER = 'x-deploy-webhook-secret';
const SENTRY_SIGNATURE_HEADERS = [
  'sentry-hook-signature',
  'x-sentry-hook-signature',
  'x-sentry-signature',
] as const;

type SentryWebhookPayload = Record<string, unknown>;

interface DeployWebhookBody {
  deploymentId?: string;
  deployment_id?: string;
}

export interface MonitorDependencies {
  now?: () => Date;
  rollbackDeploymentFn?: typeof rollbackDeployment;
}

function isDryRunEnabled(): boolean {
  return process.env.RAILWAY_DRY_RUN?.trim().toLowerCase() === 'true';
}

function getPort(): number {
  const parsedPort = Number(process.env.PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsedPort) && parsedPort > 0
    ? parsedPort
    : DEFAULT_PORT;
}

function getErrorRateThreshold(): number {
  const rawValue = process.env.SENTRY_ERROR_RATE_THRESHOLD?.trim();
  const parsedValue = Number(rawValue);

  if (!rawValue) {
    return DEFAULT_ERROR_RATE_THRESHOLD;
  }

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_ERROR_RATE_THRESHOLD;
  }

  return parsedValue > 1 ? parsedValue / 100 : parsedValue;
}

function getBearerToken(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function timingSafeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSentrySignature(secret: string, rawBody: Buffer): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function getSentrySignatureHeader(request: Request): string | undefined {
  for (const headerName of SENTRY_SIGNATURE_HEADERS) {
    const headerValue = request.header(headerName);
    if (headerValue) {
      return headerValue;
    }
  }

  return undefined;
}

export function verifySentrySignature(
  rawBody: Buffer,
  secret: string,
  signatureHeader?: string
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expectedSignature = createSentrySignature(secret, rawBody);
  const acceptedSignatures = signatureHeader
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return acceptedSignatures.some((candidate) => {
    const normalizedCandidate = candidate.startsWith('sha256=')
      ? candidate.slice(7)
      : candidate;
    return timingSafeCompare(normalizedCandidate, expectedSignature);
  });
}

function extractDeploymentId(body: DeployWebhookBody): string | undefined {
  return body.deploymentId?.trim() || body.deployment_id?.trim();
}

function normalizeRate(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value > 1 ? value / 100 : value;
}

export function extractErrorRate(
  payload: SentryWebhookPayload
): number | undefined {
  const candidates: unknown[] = [
    payload.errorRate,
    payload.error_rate,
    (payload.data as SentryWebhookPayload | undefined)?.errorRate,
    (payload.data as SentryWebhookPayload | undefined)?.error_rate,
    payload.metricValue,
    payload.metric_value,
    (payload.data as SentryWebhookPayload | undefined)?.metricValue,
    (payload.data as SentryWebhookPayload | undefined)?.metric_value,
    (payload.event as SentryWebhookPayload | undefined)?.errorRate,
    (payload.event as SentryWebhookPayload | undefined)?.error_rate,
  ];

  for (const candidate of candidates) {
    const normalizedRate = normalizeRate(candidate);
    if (normalizedRate !== undefined) {
      return normalizedRate;
    }
  }

  return undefined;
}

function resolveDeploySecret(request: Request): string | undefined {
  return (
    request.header(DEPLOY_SECRET_HEADER) ||
    getBearerToken(request.header('authorization'))
  );
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function sendUnauthorized(response: Response, detail: string): void {
  response.status(401).json({ error: detail });
}

function sendConfigError(response: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : 'Server configuration error';
  response.status(500).json({ error: message });
}

async function handleDeployWebhook(
  request: Request,
  response: Response,
  environment: DeployEnvironment,
  now: Date
): Promise<void> {
  let expectedSecret: string;

  try {
    expectedSecret = getRequiredEnv('DEPLOY_WEBHOOK_SECRET');
  } catch (error) {
    sendConfigError(response, error);
    return;
  }

  const providedSecret = resolveDeploySecret(request);
  if (!providedSecret || !timingSafeCompare(providedSecret, expectedSecret)) {
    sendUnauthorized(response, 'Invalid deploy webhook secret.');
    return;
  }

  const deploymentId = extractDeploymentId(request.body as DeployWebhookBody);
  if (!deploymentId) {
    response.status(400).json({ error: 'deploymentId is required.' });
    return;
  }

  if (isDryRunEnabled()) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          action: 'recordDeploy',
          environment,
          deploymentId,
          deployedAt: now.toISOString(),
        },
        null,
        2
      )
    );

    response.status(202).json({
      ok: true,
      dryRun: true,
      environment,
      deploymentId,
      deployedAt: now.toISOString(),
    });
    return;
  }

  const state = recordDeploy(environment, deploymentId, now);
  response.status(200).json({
    ok: true,
    environment,
    deploymentId,
    deployedAt: state[environment]?.deployedAt,
  });
}

async function handleSentryWebhook(
  request: Request,
  response: Response,
  now: Date,
  rollbackDeploymentFn: typeof rollbackDeployment
): Promise<void> {
  let sentryWebhookSecret: string;

  try {
    sentryWebhookSecret = getRequiredEnv('SENTRY_WEBHOOK_SECRET');
  } catch (error) {
    sendConfigError(response, error);
    return;
  }

  const rawBody = Buffer.isBuffer(request.body)
    ? request.body
    : Buffer.from('');
  const signatureHeader = getSentrySignatureHeader(request);

  if (!verifySentrySignature(rawBody, sentryWebhookSecret, signatureHeader)) {
    sendUnauthorized(response, 'Invalid Sentry webhook signature.');
    return;
  }

  let payload: SentryWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as SentryWebhookPayload;
  } catch {
    response.status(400).json({ error: 'Webhook payload must be valid JSON.' });
    return;
  }

  const stabilityWindow = getProductionStabilityWindowStatus(now);
  if (!stabilityWindow.active) {
    console.log(
      `Ignoring Sentry webhook outside stability window: ${stabilityWindow.reason ?? 'unknown reason'}`
    );
    response.status(202).json({
      ok: true,
      ignored: true,
      reason: stabilityWindow.reason,
    });
    return;
  }

  const errorRate = extractErrorRate(payload);
  if (errorRate === undefined) {
    console.log(
      'Ignoring Sentry webhook because no error rate was found in the payload.'
    );
    response.status(202).json({
      ok: true,
      ignored: true,
      reason: 'No error rate found in payload.',
    });
    return;
  }

  const threshold = getErrorRateThreshold();
  if (errorRate <= threshold) {
    console.log(
      `Ignoring Sentry webhook because error rate ${errorRate} is at or below threshold ${threshold}.`
    );
    response.status(202).json({
      ok: true,
      ignored: true,
      reason: 'Error rate below threshold.',
      errorRate,
      threshold,
    });
    return;
  }

  if (isDryRunEnabled()) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          action: 'rollbackDeployment',
          errorRate,
          threshold,
          deploymentId: stabilityWindow.currentDeploy?.deploymentId,
        },
        null,
        2
      )
    );
    response.status(202).json({
      ok: true,
      dryRun: true,
      wouldRollback: true,
      errorRate,
      threshold,
      deploymentId: stabilityWindow.currentDeploy?.deploymentId,
    });
    return;
  }

  const rollbackResult = await rollbackDeploymentFn();
  response.status(200).json({
    ok: true,
    rolledBack: true,
    errorRate,
    threshold,
    deploymentId: stabilityWindow.currentDeploy?.deploymentId,
    rollbackResult,
  });
}

export function createApp(dependencies: MonitorDependencies = {}): Express {
  const app = express();
  const now = dependencies.now ?? (() => new Date());
  const rollbackDeploymentFn =
    dependencies.rollbackDeploymentFn ?? rollbackDeployment;

  app.get('/health', (_request, response) => {
    response.status(200).json({ ok: true });
  });

  app.post('/deploy/staging', express.json(), async (request, response) => {
    await handleDeployWebhook(request, response, 'staging', now());
  });

  app.post('/deploy/production', express.json(), async (request, response) => {
    await handleDeployWebhook(request, response, 'production', now());
  });

  app.post(
    '/webhook/sentry',
    express.raw({ type: '*/*' }),
    async (request, response) => {
      await handleSentryWebhook(request, response, now(), rollbackDeploymentFn);
    }
  );

  return app;
}

export function startServer(): void {
  const app = createApp();
  const port = getPort();

  app.listen(port, () => {
    console.log(`Rollback monitor listening on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}
