import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import request from 'supertest';

import {
  getProductionStabilityWindowStatus,
  readDeployState,
  recordDeploy,
} from './deployState';
import {
  createApp,
  createSentrySignature,
  extractErrorRate,
  verifySentrySignature,
} from './server';

function makeTempStateFile(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'loopedagent-monitor-')
  );
  return path.join(directory, 'deploy-state.json');
}

describe('deployState', () => {
  beforeEach(() => {
    process.env.DEPLOY_STATE_FILE = makeTempStateFile();
    delete process.env.STABILITY_WINDOW_MINUTES;
  });

  afterEach(() => {
    delete process.env.DEPLOY_STATE_FILE;
    delete process.env.STABILITY_WINDOW_MINUTES;
  });

  it('records and reads a production deploy', () => {
    const deployedAt = new Date('2026-03-22T12:00:00.000Z');
    recordDeploy('production', 'deploy-123', deployedAt);

    const state = readDeployState();
    expect(state.production).toEqual({
      environment: 'production',
      deploymentId: 'deploy-123',
      deployedAt: deployedAt.toISOString(),
    });
    expect(state.stabilityWindowMinutes).toBe(15);
  });

  it('detects whether the production deploy is inside the stability window', () => {
    process.env.STABILITY_WINDOW_MINUTES = '15';
    recordDeploy(
      'production',
      'deploy-123',
      new Date('2026-03-22T12:00:00.000Z')
    );

    const activeWindow = getProductionStabilityWindowStatus(
      new Date('2026-03-22T12:10:00.000Z')
    );
    expect(activeWindow.active).toBe(true);

    const inactiveWindow = getProductionStabilityWindowStatus(
      new Date('2026-03-22T12:20:00.000Z')
    );
    expect(inactiveWindow.active).toBe(false);
  });
});

describe('server helpers', () => {
  it('verifies sentry signatures against the raw body', () => {
    const rawBody = Buffer.from('{"errorRate":0.2}');
    const secret = 'sentry-secret';
    const signature = createSentrySignature(secret, rawBody);

    expect(verifySentrySignature(rawBody, secret, signature)).toBe(true);
    expect(verifySentrySignature(rawBody, secret, `sha256=${signature}`)).toBe(
      true
    );
    expect(
      verifySentrySignature(
        rawBody,
        secret,
        crypto.randomBytes(16).toString('hex')
      )
    ).toBe(false);
  });

  it('extracts an error rate from supported payload shapes', () => {
    expect(extractErrorRate({ errorRate: 0.07 })).toBe(0.07);
    expect(extractErrorRate({ data: { error_rate: 12 } })).toBe(0.12);
    expect(extractErrorRate({ metric_value: 8 })).toBe(0.08);
    expect(extractErrorRate({})).toBeUndefined();
  });
});

describe('rollback monitor server', () => {
  const deploySecret = 'deploy-secret';
  const sentrySecret = 'sentry-secret';

  beforeEach(() => {
    process.env.DEPLOY_STATE_FILE = makeTempStateFile();
    process.env.DEPLOY_WEBHOOK_SECRET = deploySecret;
    process.env.SENTRY_WEBHOOK_SECRET = sentrySecret;
    delete process.env.RAILWAY_DRY_RUN;
    delete process.env.STABILITY_WINDOW_MINUTES;
    delete process.env.SENTRY_ERROR_RATE_THRESHOLD;
  });

  afterEach(() => {
    delete process.env.DEPLOY_STATE_FILE;
    delete process.env.DEPLOY_WEBHOOK_SECRET;
    delete process.env.SENTRY_WEBHOOK_SECRET;
    delete process.env.RAILWAY_DRY_RUN;
    delete process.env.STABILITY_WINDOW_MINUTES;
    delete process.env.SENTRY_ERROR_RATE_THRESHOLD;
  });

  it('returns a health response', async () => {
    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('rejects deploy webhooks with the wrong shared secret', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/deploy/production')
      .send({ deploymentId: 'deploy-1' });

    expect(response.status).toBe(401);
  });

  it('records a production deploy', async () => {
    const app = createApp({ now: () => new Date('2026-03-22T12:00:00.000Z') });
    const response = await request(app)
      .post('/deploy/production')
      .set('x-deploy-webhook-secret', deploySecret)
      .send({ deploymentId: 'deploy-1' });

    expect(response.status).toBe(200);
    expect(readDeployState().production?.deploymentId).toBe('deploy-1');
  });

  it('rejects sentry webhooks with an invalid signature', async () => {
    const app = createApp();
    const payload = JSON.stringify({ errorRate: 0.2 });
    const response = await request(app)
      .post('/webhook/sentry')
      .set('Content-Type', 'application/json')
      .set('sentry-hook-signature', 'invalid')
      .send(payload);

    expect(response.status).toBe(401);
  });

  it('ignores sentry webhooks outside the production stability window', async () => {
    recordDeploy(
      'production',
      'deploy-1',
      new Date('2026-03-22T12:00:00.000Z')
    );
    const rollbackDeploymentFn = jest.fn().mockResolvedValue({ ok: true });
    const app = createApp({
      now: () => new Date('2026-03-22T12:30:00.000Z'),
      rollbackDeploymentFn,
    });
    const payload = JSON.stringify({ errorRate: 0.2 });

    const response = await request(app)
      .post('/webhook/sentry')
      .set('Content-Type', 'application/json')
      .set(
        'sentry-hook-signature',
        createSentrySignature(sentrySecret, Buffer.from(payload))
      )
      .send(payload);

    expect(response.status).toBe(202);
    expect(response.body.ignored).toBe(true);
    expect(rollbackDeploymentFn).not.toHaveBeenCalled();
  });

  it('ignores sentry webhooks below the rollback threshold', async () => {
    recordDeploy(
      'production',
      'deploy-1',
      new Date('2026-03-22T12:00:00.000Z')
    );
    const rollbackDeploymentFn = jest.fn().mockResolvedValue({ ok: true });
    const app = createApp({
      now: () => new Date('2026-03-22T12:05:00.000Z'),
      rollbackDeploymentFn,
    });
    const payload = JSON.stringify({ errorRate: 0.03 });

    const response = await request(app)
      .post('/webhook/sentry')
      .set('Content-Type', 'application/json')
      .set(
        'sentry-hook-signature',
        createSentrySignature(sentrySecret, Buffer.from(payload))
      )
      .send(payload);

    expect(response.status).toBe(202);
    expect(response.body.ignored).toBe(true);
    expect(rollbackDeploymentFn).not.toHaveBeenCalled();
  });

  it('rolls back when a signed sentry webhook exceeds the threshold inside the stability window', async () => {
    recordDeploy(
      'production',
      'deploy-1',
      new Date('2026-03-22T12:00:00.000Z')
    );
    const rollbackDeploymentFn = jest.fn().mockResolvedValue({
      dryRun: false,
      request: { deploymentId: 'deploy-1' },
      response: { data: { deploymentRollback: true } },
    });
    const app = createApp({
      now: () => new Date('2026-03-22T12:05:00.000Z'),
      rollbackDeploymentFn,
    });
    const payload = JSON.stringify({ data: { error_rate: 7 } });

    const response = await request(app)
      .post('/webhook/sentry')
      .set('Content-Type', 'application/json')
      .set(
        'sentry-hook-signature',
        createSentrySignature(sentrySecret, Buffer.from(payload))
      )
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.rolledBack).toBe(true);
    expect(rollbackDeploymentFn).toHaveBeenCalledTimes(1);
  });

  it('honors dry run mode for deploy and rollback actions', async () => {
    process.env.RAILWAY_DRY_RUN = 'true';
    const rollbackDeploymentFn = jest.fn().mockResolvedValue({ ok: true });
    const app = createApp({
      now: () => new Date('2026-03-22T12:05:00.000Z'),
      rollbackDeploymentFn,
    });

    const deployResponse = await request(app)
      .post('/deploy/production')
      .set('x-deploy-webhook-secret', deploySecret)
      .send({ deploymentId: 'deploy-1' });

    expect(deployResponse.status).toBe(202);
    expect(readDeployState().production).toBeUndefined();

    recordDeploy(
      'production',
      'deploy-1',
      new Date('2026-03-22T12:00:00.000Z')
    );
    const payload = JSON.stringify({ errorRate: 0.2 });
    const sentryResponse = await request(app)
      .post('/webhook/sentry')
      .set('Content-Type', 'application/json')
      .set(
        'sentry-hook-signature',
        createSentrySignature(sentrySecret, Buffer.from(payload))
      )
      .send(payload);

    expect(sentryResponse.status).toBe(202);
    expect(sentryResponse.body.wouldRollback).toBe(true);
    expect(rollbackDeploymentFn).not.toHaveBeenCalled();
  });
});
