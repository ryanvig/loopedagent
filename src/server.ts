import crypto from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';

import {
  type DeployEnvironment,
  getProductionStabilityWindowStatus,
  recordDeploy,
} from './deployState';
import { rollbackDeployment } from './railway';
import { ConvexWriter } from './convex';

const DEFAULT_PORT = 3000;
const DEFAULT_ERROR_RATE_THRESHOLD = 0.05;
const DEPLOY_SECRET_HEADER = 'x-deploy-webhook-secret';
const GITHUB_SIGNATURE_HEADER = 'x-hub-signature-256';
const GITHUB_API_BASE = 'https://api.github.com/repos/ryanvig/Looped';
const GITHUB_ACTIONS_WORKFLOW_NAME = 'Kimi Builder';
const POLL_INTERVAL_MS = 2 * 60 * 1000;
const SENTRY_SIGNATURE_HEADERS = [
  'sentry-hook-signature',
  'x-sentry-hook-signature',
  'x-sentry-signature',
] as const;

type SentryWebhookPayload = Record<string, unknown>;
type FetchLike = typeof fetch;

interface DeployWebhookBody {
  deploymentId?: string;
  deployment_id?: string;
}

interface GitHubIssueLabel {
  name?: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  labels: GitHubIssueLabel[];
}

interface GitHubUser {
  login: string;
  type?: string;
}

interface GitHubIssueComment {
  body?: string | null;
}

interface GitHubReview {
  state?: string | null;
  body?: string | null;
  user?: GitHubUser | null;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  html_url: string;
  body?: string | null;
  head: {
    ref: string;
    sha: string;
  };
  user: GitHubUser;
  labels: GitHubIssueLabel[];
  requested_reviewers?: GitHubUser[];
  merged_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface GitHubWorkflowRun {
  name?: string | null;
  display_title?: string | null;
  html_url?: string | null;
  head_branch?: string | null;
  status?: string | null;
  conclusion?: string | null;
  pull_requests?: Array<{ number?: number; html_url?: string | null }>;
}

interface GitHubWorkflowRunsResponse {
  workflow_runs: GitHubWorkflowRun[];
}

interface GitHubCombinedStatus {
  state?: 'pending' | 'success' | 'failure' | 'error';
}

interface GitHubPullRequestWebhookBody {
  action?: string;
  pull_request?: {
    body?: string | null;
    merged?: boolean;
  };
}

interface GitHubActionsWebhookBody {
  action?: string;
  workflow_run?: GitHubWorkflowRun;
}

interface BrainDriftWebhookBody {
  status: 'current' | 'drift_detected' | 'error';
  driftSummary: string[];
  filesChanged: string[];
  nextCheckAt?: number;
}

export interface MonitorDependencies {
  now?: () => Date;
  rollbackDeploymentFn?: typeof rollbackDeployment;
  fetchFn?: FetchLike;
}

const STARTUP_AGENTS = [
  {
    agentId: 'openclaw-architect',
    agentName: 'OpenClaw Architect',
    role: 'Architect — generates specs and creates GitHub issues',
    status: 'idle' as const,
    lastAction: 'Initialized',
    links: [
      {
        label: 'looped-infra',
        url: 'https://github.com/ryanvig/looped-infra',
      },
    ],
  },
  {
    agentId: 'kimi-builder',
    agentName: 'Kimi Code Builder',
    role: 'Builder — implements features from architect handoffs',
    status: 'idle' as const,
    lastAction: 'Initialized',
    links: [
      {
        label: 'GitHub Actions',
        url: 'https://github.com/ryanvig/Looped/actions',
      },
    ],
  },
  {
    agentId: 'openclaw-reviewer',
    agentName: 'OpenClaw Reviewer',
    role: 'Reviewer — reviews Kimi PRs against Looped conventions',
    status: 'idle' as const,
    lastAction: 'Initialized',
    links: [
      {
        label: 'Open PRs',
        url: 'https://github.com/ryanvig/Looped/pulls',
      },
    ],
  },
  {
    agentId: 'openclaw-monitor',
    agentName: 'OpenClaw Monitor',
    role: 'Monitor — detects knowledge drift and production issues',
    status: 'idle' as const,
    lastAction: 'Initialized',
    links: [
      {
        label: 'Drift check',
        url: 'https://github.com/ryanvig/Looped/actions/workflows/brain-drift-check.yml',
      },
    ],
  },
  {
    agentId: 'loopedagent-safety',
    agentName: 'Production Safety Monitor',
    role: 'Monitor — monitors error rates and triggers Railway rollbacks',
    status: 'idle' as const,
    lastAction: 'Initialized',
    links: [
      {
        label: 'Monitor service',
        url: 'https://loopedagent-production.up.railway.app',
      },
    ],
  },
  {
    agentId: 'design-agent',
    agentName: 'Design Agent',
    role: 'Designer — visual system enforcement and UI review',
    status: 'idle' as const,
    lastAction: 'Initialized',
    links: [
      {
        label: 'Design brain',
        url: 'https://github.com/ryanvig/looped-infra/tree/main/brain/design',
      },
    ],
  },
  {
    agentId: 'marketing-agent',
    agentName: 'Marketing Agent',
    role: 'Coming Soon',
    status: 'offline' as const,
    lastAction: 'Not yet initialized',
    links: [],
  },
  {
    agentId: 'sales-agent',
    agentName: 'Sales Agent',
    role: 'Coming Soon',
    status: 'offline' as const,
    lastAction: 'Not yet initialized',
    links: [],
  },
];

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

function createHmacSignature(secret: string, rawBody: Buffer): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function createSentrySignature(secret: string, rawBody: Buffer): string {
  return createHmacSignature(secret, rawBody);
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

function verifyHmacSignature(
  rawBody: Buffer,
  secret: string,
  signatureHeader?: string
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expectedSignature = createHmacSignature(secret, rawBody);
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

export function verifySentrySignature(
  rawBody: Buffer,
  secret: string,
  signatureHeader?: string
): boolean {
  return verifyHmacSignature(rawBody, secret, signatureHeader);
}

function verifyGitHubSignature(
  rawBody: Buffer,
  secret: string,
  signatureHeader?: string
): boolean {
  return verifyHmacSignature(rawBody, secret, signatureHeader);
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

function getRawBody(request: Request): Buffer {
  return Buffer.isBuffer(request.body) ? request.body : Buffer.from('');
}

function parseJsonBody<T>(rawBody: Buffer): T {
  return JSON.parse(rawBody.toString('utf8')) as T;
}

function extractIssueNumbersFromText(text?: string | null): number[] {
  if (!text) {
    return [];
  }

  const matches = text.matchAll(/\b(?:closes|fixes)\s+#(\d+)\b/gi);
  return Array.from(
    new Set(Array.from(matches, (match) => Number(match[1])))
  ).filter((value) => Number.isFinite(value) && value > 0);
}

function extractIssueNumberFromBranch(
  branch?: string | null
): number | undefined {
  if (!branch) {
    return undefined;
  }

  const match = branch.match(/^feature\/issue-(\d+)-/i);
  if (!match) {
    return undefined;
  }

  const issueNumber = Number(match[1]);
  return Number.isFinite(issueNumber) ? issueNumber : undefined;
}

function mapCombinedStatusToCiStatus(
  state?: string | null
): 'pending' | 'passing' | 'failing' {
  if (state === 'success') {
    return 'passing';
  }
  if (state === 'failure' || state === 'error') {
    return 'failing';
  }
  return 'pending';
}

function isNonBotUser(user?: GitHubUser | null): boolean {
  if (!user?.login) {
    return false;
  }
  return user.type !== 'Bot' && !user.login.endsWith('[bot]');
}

function determinePullRequestStatus(
  pullRequest: GitHubPullRequest,
  reviews: GitHubReview[]
): 'open' | 'review_requested' | 'changes_requested' | 'approved' {
  if (reviews.some((review) => review.state === 'CHANGES_REQUESTED')) {
    return 'changes_requested';
  }
  if (reviews.some((review) => review.state === 'APPROVED')) {
    return 'approved';
  }
  if ((pullRequest.requested_reviewers?.length ?? 0) > 0) {
    return 'review_requested';
  }
  return 'open';
}

function hasDesignReviewMarker(
  pullRequest: GitHubPullRequest,
  reviews: GitHubReview[],
  comments: GitHubIssueComment[]
): boolean {
  if (pullRequest.labels.some((label) => label.name === 'design-reviewed')) {
    return true;
  }

  const bodies = [
    ...reviews.map((review) => review.body),
    ...comments.map((comment) => comment.body),
  ];
  return bodies.some((body) => body?.toLowerCase().includes('design-review'));
}

function hasEngineeringApproval(reviews: GitHubReview[]): boolean {
  return reviews.some(
    (review) => review.state === 'APPROVED' && isNonBotUser(review.user)
  );
}

function mapWorkflowRunToBuildStatus(
  run: GitHubWorkflowRun
): 'queued' | 'building' | 'pr_opened' | 'failed' | 'completed' {
  if (run.status === 'in_progress') {
    return 'building';
  }
  if (
    run.status === 'queued' ||
    run.status === 'requested' ||
    run.status === 'pending'
  ) {
    return 'queued';
  }
  if (run.conclusion === 'success') {
    return 'pr_opened';
  }
  if (
    run.conclusion === 'failure' ||
    run.conclusion === 'cancelled' ||
    run.conclusion === 'timed_out'
  ) {
    return 'failed';
  }
  return 'completed';
}

async function postSlackMessage(
  webhookUrl: string | undefined,
  text: string,
  fetchFn: FetchLike
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  try {
    await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.error('[Slack] webhook post failed:', error);
  }
}

async function githubRequest<T>(
  path: string,
  fetchFn: FetchLike,
  init: RequestInit = {}
): Promise<T> {
  const token = getRequiredEnv('GITHUB_TOKEN');
  const response = await fetchFn(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'loopedagent-monitor',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub API request failed (${response.status} ${response.statusText}): ${body}`
    );
  }

  return (await response.json()) as T;
}

async function fetchIssue(
  issueNumber: number,
  fetchFn: FetchLike
): Promise<GitHubIssue> {
  return githubRequest<GitHubIssue>(`/issues/${issueNumber}`, fetchFn);
}

async function fetchOldestBacklogIssue(
  fetchFn: FetchLike
): Promise<GitHubIssue | undefined> {
  const issues = await githubRequest<GitHubIssue[]>(
    '/issues?state=open&labels=build:backlog&sort=created&direction=asc&per_page=1',
    fetchFn
  );
  return issues[0];
}

async function relabelBacklogIssue(
  issueNumber: number,
  fetchFn: FetchLike
): Promise<void> {
  await githubRequest<void>(
    `/issues/${issueNumber}/labels/build%3Abacklog`,
    fetchFn,
    { method: 'DELETE' }
  );
  await githubRequest<void>(`/issues/${issueNumber}/labels`, fetchFn, {
    method: 'POST',
    body: JSON.stringify({ labels: ['build:ready'] }),
  });
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
  await ConvexWriter.upsertProductionHealth({
    service: environment,
    status: 'healthy',
    deploymentId,
    lastDeployAt: now.getTime(),
    sentryAlerts: 0,
  });

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

  const rawBody = getRawBody(request);
  const signatureHeader = getSentrySignatureHeader(request);

  if (!verifySentrySignature(rawBody, sentryWebhookSecret, signatureHeader)) {
    sendUnauthorized(response, 'Invalid Sentry webhook signature.');
    return;
  }

  let payload: SentryWebhookPayload;
  try {
    payload = parseJsonBody<SentryWebhookPayload>(rawBody);
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
    await ConvexWriter.upsertProductionHealth({
      service: 'production',
      status: 'degraded',
      errorRate,
      deploymentId: stabilityWindow.currentDeploy?.deploymentId,
      lastDeployAt: stabilityWindow.currentDeploy
        ? new Date(stabilityWindow.currentDeploy.deployedAt).getTime()
        : undefined,
      sentryAlerts: 1,
    });
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
  await ConvexWriter.upsertProductionHealth({
    service: 'production',
    status: 'rolled_back',
    errorRate,
    deploymentId: stabilityWindow.currentDeploy?.deploymentId,
    lastDeployAt: stabilityWindow.currentDeploy
      ? new Date(stabilityWindow.currentDeploy.deployedAt).getTime()
      : undefined,
    sentryAlerts: 1,
  });
  response.status(200).json({
    ok: true,
    rolledBack: true,
    errorRate,
    threshold,
    deploymentId: stabilityWindow.currentDeploy?.deploymentId,
    rollbackResult,
  });
}

async function handleGitHubPullRequestWebhook(
  request: Request,
  response: Response,
  fetchFn: FetchLike
): Promise<void> {
  let webhookSecret: string;

  try {
    webhookSecret = getRequiredEnv('GITHUB_WEBHOOK_SECRET');
  } catch (error) {
    sendConfigError(response, error);
    return;
  }

  const rawBody = getRawBody(request);
  if (
    !verifyGitHubSignature(
      rawBody,
      webhookSecret,
      request.header(GITHUB_SIGNATURE_HEADER)
    )
  ) {
    sendUnauthorized(response, 'Invalid GitHub webhook signature.');
    return;
  }

  let payload: GitHubPullRequestWebhookBody;
  try {
    payload = parseJsonBody<GitHubPullRequestWebhookBody>(rawBody);
  } catch {
    response.status(400).json({ error: 'Webhook payload must be valid JSON.' });
    return;
  }

  if (payload.action !== 'closed' || payload.pull_request?.merged !== true) {
    response.status(200).json({ ok: true, ignored: true });
    return;
  }

  const linkedIssueNumbers = extractIssueNumbersFromText(
    payload.pull_request.body
  );
  if (linkedIssueNumbers.length === 0) {
    console.log('[GitHub PR webhook] merged PR closed no build-linked issue.');
    response.status(200).json({ ok: true, advanced: false });
    return;
  }

  for (const issueNumber of linkedIssueNumbers) {
    const issue = await fetchIssue(issueNumber, fetchFn);
    const hasBuildReady = issue.labels.some(
      (label) => label.name === 'build:ready'
    );
    if (!hasBuildReady) {
      continue;
    }

    const backlogIssue = await fetchOldestBacklogIssue(fetchFn);
    if (!backlogIssue) {
      console.log('[GitHub PR webhook] no backlog issue to advance.');
      response
        .status(200)
        .json({ ok: true, advanced: false, reason: 'empty_queue' });
      return;
    }

    await relabelBacklogIssue(backlogIssue.number, fetchFn);
    await ConvexWriter.upsertBuildEvent({
      issueNumber: backlogIssue.number,
      issueTitle: backlogIssue.title,
      issueUrl: backlogIssue.html_url,
      status: 'queued',
      agentName: 'kimi-builder',
    });
    await postSlackMessage(
      process.env.SLACK_LOGS_WEBHOOK_URL,
      `Build backlog advanced — ${backlogIssue.title} is now build:ready`,
      fetchFn
    );

    response.status(200).json({
      ok: true,
      advanced: true,
      issueNumber: backlogIssue.number,
    });
    return;
  }

  response
    .status(200)
    .json({ ok: true, advanced: false, reason: 'no_build_ready_issue' });
}

async function handleGitHubActionsWebhook(
  request: Request,
  response: Response,
  fetchFn: FetchLike
): Promise<void> {
  let webhookSecret: string;

  try {
    webhookSecret = getRequiredEnv('GITHUB_WEBHOOK_SECRET');
  } catch (error) {
    sendConfigError(response, error);
    return;
  }

  const rawBody = getRawBody(request);
  if (
    !verifyGitHubSignature(
      rawBody,
      webhookSecret,
      request.header(GITHUB_SIGNATURE_HEADER)
    )
  ) {
    sendUnauthorized(response, 'Invalid GitHub webhook signature.');
    return;
  }

  let payload: GitHubActionsWebhookBody;
  try {
    payload = parseJsonBody<GitHubActionsWebhookBody>(rawBody);
  } catch {
    response.status(400).json({ error: 'Webhook payload must be valid JSON.' });
    return;
  }

  const run = payload.workflow_run;
  if (!run || run.name !== GITHUB_ACTIONS_WORKFLOW_NAME) {
    response.status(200).json({ ok: true, ignored: true });
    return;
  }

  const issueNumber = extractIssueNumberFromBranch(run.head_branch);
  if (!issueNumber) {
    response
      .status(200)
      .json({ ok: true, ignored: true, reason: 'no_issue_number' });
    return;
  }

  const issue = await fetchIssue(issueNumber, fetchFn);
  const branch = run.head_branch ?? '';

  if (payload.action === 'in_progress') {
    await ConvexWriter.upsertBuildEvent({
      issueNumber,
      issueTitle: issue.title,
      issueUrl: issue.html_url,
      status: 'building',
      branch,
      agentName: 'kimi-builder',
      logs: run.html_url ?? undefined,
    });
    await ConvexWriter.upsertAgentStatus({
      agentId: 'kimi-builder',
      agentName: 'Kimi Code Builder',
      role: 'Builder — implements features from architect handoffs',
      status: 'active',
      lastAction: `Building issue #${issueNumber}`,
      currentTask: branch,
      links: [{ label: 'Workflow run', url: run.html_url ?? issue.html_url }],
    });
  } else if (payload.action === 'completed') {
    const successful = run.conclusion === 'success';
    await ConvexWriter.upsertBuildEvent({
      issueNumber,
      issueTitle: issue.title,
      issueUrl: issue.html_url,
      status: successful ? 'pr_opened' : 'failed',
      branch,
      prNumber: run.pull_requests?.[0]?.number,
      prUrl: run.pull_requests?.[0]?.html_url ?? undefined,
      agentName: 'kimi-builder',
      logs: run.html_url ?? undefined,
    });
    await ConvexWriter.upsertAgentStatus({
      agentId: 'kimi-builder',
      agentName: 'Kimi Code Builder',
      role: 'Builder — implements features from architect handoffs',
      status: 'idle',
      lastAction: successful
        ? `PR opened for issue #${issueNumber}`
        : `Build failed for issue #${issueNumber}`,
      links: [{ label: 'Workflow run', url: run.html_url ?? issue.html_url }],
    });
  }

  response.status(200).json({ ok: true });
}

async function handleBrainDriftWebhook(
  request: Request,
  response: Response,
  fetchFn: FetchLike
): Promise<void> {
  const payload = request.body as BrainDriftWebhookBody;

  await ConvexWriter.insertKnowledgeHealth(payload);
  await ConvexWriter.upsertAgentStatus({
    agentId: 'openclaw-monitor',
    agentName: 'OpenClaw Monitor',
    role: 'Monitor — detects knowledge drift and production issues',
    status: 'idle',
    lastAction:
      payload.status === 'drift_detected'
        ? 'Knowledge drift detected'
        : payload.status === 'error'
          ? 'Knowledge drift check errored'
          : 'Knowledge layer current',
    links: [
      {
        label: 'Drift check',
        url: 'https://github.com/ryanvig/Looped/actions/workflows/brain-drift-check.yml',
      },
    ],
  });

  if (payload.status === 'drift_detected') {
    await postSlackMessage(
      process.env.SLACK_ALERTS_WEBHOOK_URL,
      `Brain drift detected: ${payload.driftSummary.join('; ') || 'see drift report'}`,
      fetchFn
    );
  } else if (payload.status === 'current') {
    await postSlackMessage(
      process.env.SLACK_LOGS_WEBHOOK_URL,
      'Brain drift check completed — knowledge layer current.',
      fetchFn
    );
  }

  response.status(200).json({ ok: true });
}

export async function pollGitHubState(fetchFn: FetchLike): Promise<void> {
  try {
    const pullRequests = await githubRequest<GitHubPullRequest[]>(
      '/pulls?state=open&per_page=20',
      fetchFn
    );

    for (const pullRequest of pullRequests) {
      const [combinedStatus, reviews, comments] = await Promise.all([
        githubRequest<GitHubCombinedStatus>(
          `/commits/${pullRequest.head.sha}/status`,
          fetchFn
        ),
        githubRequest<GitHubReview[]>(
          `/pulls/${pullRequest.number}/reviews`,
          fetchFn
        ),
        githubRequest<GitHubIssueComment[]>(
          `/issues/${pullRequest.number}/comments`,
          fetchFn
        ),
      ]);

      const linkedIssue = extractIssueNumbersFromText(pullRequest.body)[0];
      await ConvexWriter.upsertPullRequest({
        prNumber: pullRequest.number,
        prTitle: pullRequest.title,
        prUrl: pullRequest.html_url,
        branch: pullRequest.head.ref,
        status: determinePullRequestStatus(pullRequest, reviews),
        author: pullRequest.user.login,
        hasDesignReview: hasDesignReviewMarker(pullRequest, reviews, comments),
        hasEngineeringReview: hasEngineeringApproval(reviews),
        ciStatus: mapCombinedStatusToCiStatus(combinedStatus.state),
        issueNumber: linkedIssue,
      });
    }

    const workflowRuns = await githubRequest<GitHubWorkflowRunsResponse>(
      '/actions/workflows/kimi-builder.yml/runs?per_page=5',
      fetchFn
    );

    for (const run of workflowRuns.workflow_runs) {
      const issueNumber = extractIssueNumberFromBranch(run.head_branch);
      if (!issueNumber) {
        continue;
      }

      const issue = await fetchIssue(issueNumber, fetchFn);
      await ConvexWriter.upsertBuildEvent({
        issueNumber,
        issueTitle: issue.title,
        issueUrl: issue.html_url,
        status: mapWorkflowRunToBuildStatus(run),
        branch: run.head_branch ?? undefined,
        prNumber: run.pull_requests?.[0]?.number,
        prUrl: run.pull_requests?.[0]?.html_url ?? undefined,
        agentName: 'kimi-builder',
        logs: run.html_url ?? undefined,
      });
    }
  } catch (error) {
    console.error('[GitHub poll] failed:', error);
  }
}

export function startBackgroundPolling(fetchFn: FetchLike): void {
  const runPoll = () => {
    try {
      void pollGitHubState(fetchFn);
    } catch (error) {
      console.error('[GitHub poll] scheduler failed:', error);
    }
  };

  runPoll();
  const timer = setInterval(runPoll, POLL_INTERVAL_MS);
  timer.unref();
}

export async function seedAgentStatus(): Promise<void> {
  try {
    await Promise.allSettled(
      STARTUP_AGENTS.map((agent) => ConvexWriter.upsertAgentStatus(agent))
    );
  } catch (error) {
    console.error('[Convex] startup agent seed failed:', error);
  }
}

export function createApp(dependencies: MonitorDependencies = {}): Express {
  const app = express();
  const now = dependencies.now ?? (() => new Date());
  const rollbackDeploymentFn =
    dependencies.rollbackDeploymentFn ?? rollbackDeployment;
  const fetchFn = dependencies.fetchFn ?? fetch;

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
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

  app.post(
    '/webhooks/github-pull-request',
    express.raw({ type: 'application/json' }),
    async (request, response) => {
      await handleGitHubPullRequestWebhook(request, response, fetchFn);
    }
  );

  app.post(
    '/webhooks/github-actions',
    express.raw({ type: 'application/json' }),
    async (request, response) => {
      await handleGitHubActionsWebhook(request, response, fetchFn);
    }
  );

  app.post(
    '/webhooks/brain-drift',
    express.json(),
    async (request, response) => {
      await handleBrainDriftWebhook(request, response, fetchFn);
    }
  );

  return app;
}

export function startServer(): void {
  const fetchFn = fetch;
  const app = createApp({ fetchFn });
  const port = getPort();

  app.listen(port, () => {
    console.log(`[loopedagent] Server listening on port ${port}`);
    console.log(
      `[loopedagent] CONVEX_URL: ${process.env.CONVEX_URL ? 'set' : 'not set'}`
    );
    console.log(
      `[loopedagent] GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? 'set' : 'not set'}`
    );

    try {
      void seedAgentStatus();
    } catch (error) {
      console.error('[loopedagent] startup agent seeding failed:', error);
    }

    try {
      startBackgroundPolling(fetchFn);
    } catch (error) {
      console.error('[loopedagent] background polling startup failed:', error);
    }
  });
}

/* istanbul ignore next */
if (require.main === module) {
  startServer();
}
