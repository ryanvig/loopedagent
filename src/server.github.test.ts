import crypto from 'node:crypto';

import request from 'supertest';

import {
  clearPendingDesignReviews,
  createApp,
  pollGitHubState,
  seedAgentStatus,
  startBackgroundPolling,
} from './server';
import { ConvexWriter } from './convex';

jest.mock('./convex', () => ({
  ConvexWriter: {
    upsertBuildEvent: jest.fn().mockResolvedValue(undefined),
    upsertAgentStatus: jest.fn().mockResolvedValue(undefined),
    upsertPullRequest: jest.fn().mockResolvedValue(undefined),
    insertKnowledgeHealth: jest.fn().mockResolvedValue(undefined),
    upsertProductionHealth: jest.fn().mockResolvedValue(undefined),
  },
}));

function createGitHubSignature(secret: string, body: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

describe('github and mission-control webhooks', () => {
  const githubSecret = 'github-secret';
  const githubToken = 'github-token';
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    clearPendingDesignReviews();
    process.env.GITHUB_WEBHOOK_SECRET = githubSecret;
    process.env.GITHUB_TOKEN = githubToken;
    process.env.SLACK_LOGS_WEBHOOK_URL = 'https://slack.example/logs';
    process.env.SLACK_ALERTS_WEBHOOK_URL = 'https://slack.example/alerts';
    process.env.SLACK_DESIGN_REVIEW_WEBHOOK_URL =
      'https://slack.example/design-review';
  });

  afterEach(() => {
    clearPendingDesignReviews();
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.GITHUB_TOKEN;
    delete process.env.SLACK_LOGS_WEBHOOK_URL;
    delete process.env.SLACK_ALERTS_WEBHOOK_URL;
    delete process.env.SLACK_DESIGN_REVIEW_WEBHOOK_URL;
  });

  it('rejects GitHub PR webhooks with an invalid signature', async () => {
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const response = await request(app)
      .post('/webhooks/github-pull-request')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=wrong')
      .send(
        JSON.stringify({ action: 'closed', pull_request: { merged: true } })
      );

    expect(response.status).toBe(401);
  });

  it('gracefully ignores non-merged PR events', async () => {
    const payload = JSON.stringify({
      action: 'synchronize',
      pull_request: { merged: false, body: null },
    });
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const response = await request(app)
      .post('/webhooks/github-pull-request')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', createGitHubSignature(githubSecret, payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.ignored).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no_build_ready_issue when linked issues are not build-ready', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        number: 12,
        title: 'Spec only issue',
        html_url: 'https://github.com/ryanvig/Looped/issues/12',
        labels: [{ name: 'bug' }],
      })
    );

    const payload = JSON.stringify({
      action: 'closed',
      pull_request: { merged: true, body: 'Closes #12' },
    });
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const response = await request(app)
      .post('/webhooks/github-pull-request')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', createGitHubSignature(githubSecret, payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.reason).toBe('no_build_ready_issue');
    expect(ConvexWriter.upsertBuildEvent).not.toHaveBeenCalled();
  });

  it('handles an empty backlog queue gracefully', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          number: 12,
          title: 'Current build',
          html_url: 'https://github.com/ryanvig/Looped/issues/12',
          labels: [{ name: 'build:ready' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse([]));

    const payload = JSON.stringify({
      action: 'closed',
      pull_request: { merged: true, body: 'Fixes #12' },
    });
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const response = await request(app)
      .post('/webhooks/github-pull-request')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', createGitHubSignature(githubSecret, payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.reason).toBe('empty_queue');
  });

  it('advances the oldest backlog issue after a build-ready PR merges', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          number: 12,
          title: 'Current build',
          html_url: 'https://github.com/ryanvig/Looped/issues/12',
          labels: [{ name: 'build:ready' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 13,
            title: 'Next queued build',
            html_url: 'https://github.com/ryanvig/Looped/issues/13',
            labels: [{ name: 'build:backlog' }],
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse({}, 200))
      .mockResolvedValueOnce(jsonResponse({}, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));

    const payload = JSON.stringify({
      action: 'closed',
      pull_request: { merged: true, body: 'Closes #12' },
    });
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const response = await request(app)
      .post('/webhooks/github-pull-request')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', createGitHubSignature(githubSecret, payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.issueNumber).toBe(13);
    expect(ConvexWriter.upsertBuildEvent).toHaveBeenCalledWith({
      issueNumber: 13,
      issueTitle: 'Next queued build',
      issueUrl: 'https://github.com/ryanvig/Looped/issues/13',
      status: 'queued',
      agentName: 'kimi-builder',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.example/logs',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('tracks Kimi Builder workflow runs from the GitHub Actions webhook', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        number: 18,
        title: 'Issue 18',
        html_url: 'https://github.com/ryanvig/Looped/issues/18',
        labels: [{ name: 'build:ready' }],
      })
    );
    const app = createApp({ fetchFn: fetchMock as typeof fetch });
    const payload = JSON.stringify({
      action: 'in_progress',
      workflow_run: {
        name: 'Kimi Builder',
        head_branch: 'feature/issue-18-thread-posts',
        html_url: 'https://github.com/ryanvig/Looped/actions/runs/18',
      },
    });

    const response = await request(app)
      .post('/webhooks/github-actions')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', createGitHubSignature(githubSecret, payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(ConvexWriter.upsertBuildEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        issueNumber: 18,
        status: 'building',
        branch: 'feature/issue-18-thread-posts',
      })
    );
    expect(ConvexWriter.upsertAgentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'kimi-builder',
        status: 'active',
        currentTask: 'feature/issue-18-thread-posts',
      })
    );
  });

  it('marks successful Kimi runs as PR-opened and failed runs as failed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          number: 18,
          title: 'Issue 18',
          html_url: 'https://github.com/ryanvig/Looped/issues/18',
          labels: [{ name: 'build:ready' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          number: 19,
          title: 'Issue 19',
          html_url: 'https://github.com/ryanvig/Looped/issues/19',
          labels: [{ name: 'build:ready' }],
        })
      );
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const successPayload = JSON.stringify({
      action: 'completed',
      workflow_run: {
        name: 'Kimi Builder',
        conclusion: 'success',
        head_branch: 'feature/issue-18-thread-posts',
        html_url: 'https://github.com/ryanvig/Looped/actions/runs/18',
        pull_requests: [
          {
            number: 88,
            html_url: 'https://github.com/ryanvig/Looped/pull/88',
          },
        ],
      },
    });
    const failurePayload = JSON.stringify({
      action: 'completed',
      workflow_run: {
        name: 'Kimi Builder',
        conclusion: 'failure',
        head_branch: 'feature/issue-19-comment-moderation',
        html_url: 'https://github.com/ryanvig/Looped/actions/runs/19',
      },
    });

    await request(app)
      .post('/webhooks/github-actions')
      .set('Content-Type', 'application/json')
      .set(
        'x-hub-signature-256',
        createGitHubSignature(githubSecret, successPayload)
      )
      .send(successPayload);
    await request(app)
      .post('/webhooks/github-actions')
      .set('Content-Type', 'application/json')
      .set(
        'x-hub-signature-256',
        createGitHubSignature(githubSecret, failurePayload)
      )
      .send(failurePayload);

    expect(ConvexWriter.upsertBuildEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        issueNumber: 18,
        status: 'pr_opened',
        prNumber: 88,
      })
    );
    expect(ConvexWriter.upsertBuildEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        issueNumber: 19,
        status: 'failed',
      })
    );
  });

  it('records brain drift webhook status and routes Slack notifications', async () => {
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const currentResponse = await request(app)
      .post('/webhooks/brain-drift')
      .send({ status: 'current', driftSummary: [], filesChanged: [] });
    const driftResponse = await request(app)
      .post('/webhooks/brain-drift')
      .send({
        status: 'drift_detected',
        driftSummary: ['routes.yaml changed'],
        filesChanged: ['looped-infra/brain/knowledge/routes.yaml'],
      });

    expect(currentResponse.status).toBe(200);
    expect(driftResponse.status).toBe(200);
    expect(ConvexWriter.insertKnowledgeHealth).toHaveBeenCalledTimes(2);
    expect(ConvexWriter.upsertAgentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'openclaw-monitor',
        lastAction: 'Knowledge drift detected',
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.example/alerts',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.example/logs',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('registers and lists pending design reviews', async () => {
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const registerResponse = await request(app)
      .post('/design-review/register')
      .send({
        prNumber: '42',
        prTitle: 'Polish profile shell',
        prRepo: 'ryanvig/Looped',
      });
    const pendingResponse = await request(app).get('/design-review/pending');

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.ok).toBe(true);
    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.pending).toHaveLength(1);
    expect(pendingResponse.body.pending[0]).toEqual(
      expect.objectContaining({
        prNumber: '42',
        prTitle: 'Polish profile shell',
        prRepo: 'ryanvig/Looped',
      })
    );
  });

  describe('POST /design-review/generate', () => {
    it('should return 200 with ok:true for valid payload', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          content: [
            {
              type: 'text',
              text: '{"variants":[]}',
            },
          ],
        })
      );

      const app = createApp({ fetchFn: fetchMock as typeof fetch });

      const response = await request(app).post('/design-review/generate').send({
        prNumber: '99',
        prTitle: 'test PR',
        prBranch: 'feature/test',
        prRepo: 'ryanvig/Looped',
        uiFiles: 'mobile/src/components/Test.tsx',
        diff: 'test diff',
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.status).toBe('generating');
    });

    it('should return 400 for missing required fields', async () => {
      const app = createApp({ fetchFn: fetchMock as typeof fetch });

      const response = await request(app)
        .post('/design-review/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Missing required fields: prNumber, prTitle, prBranch, prRepo'
      );
    });
  });

  it('handles Slack URL verification for design review webhooks', async () => {
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    const response = await request(app)
      .post('/webhooks/slack-design-review')
      .send({
        type: 'url_verification',
        challenge: 'challenge-token',
      });

    expect(response.status).toBe(200);
    expect(response.body.challenge).toBe('challenge-token');
  });

  it('creates a build-ready implementation issue when a design variant is selected', async () => {
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    await request(app).post('/design-review/register').send({
      prNumber: '51',
      prTitle: 'Refine discover cards',
      prRepo: 'ryanvig/Looped',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          number: 200,
          title: 'feat(design): implement Variant B from PR #51 design review',
          html_url: 'https://github.com/ryanvig/Looped/issues/200',
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const response = await request(app)
      .post('/webhooks/slack-design-review')
      .send({
        event: {
          type: 'message',
          text: 'B',
          channel: 'C123',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.selectedVariant).toBe('B');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/ryanvig/Looped/issues',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://slack.example/design-review',
      expect.objectContaining({ method: 'POST' })
    );

    const pendingResponse = await request(app).get('/design-review/pending');
    expect(pendingResponse.body.pending).toHaveLength(0);
  });

  it('acknowledges freeform Slack feedback for design reviews', async () => {
    const app = createApp({ fetchFn: fetchMock as typeof fetch });

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const response = await request(app)
      .post('/webhooks/slack-design-review')
      .send({
        event: {
          type: 'message',
          text: 'Can we make Variant B feel airier?',
          channel: 'C123',
        },
      });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.example/design-review',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('polls GitHub state into Convex and swallows polling failures', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 88,
            title: 'Open PR',
            html_url: 'https://github.com/ryanvig/Looped/pull/88',
            body: 'Closes #18',
            head: { ref: 'feature/issue-18-thread-posts', sha: 'abc123' },
            user: { login: 'ryanvig', type: 'User' },
            labels: [{ name: 'design-reviewed' }],
            requested_reviewers: [],
            created_at: '2026-04-01T10:00:00.000Z',
            updated_at: '2026-04-01T10:10:00.000Z',
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ state: 'success' }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            state: 'APPROVED',
            body: 'Looks good',
            user: { login: 'reviewer', type: 'User' },
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ body: 'design-review complete' }]))
      .mockResolvedValueOnce(
        jsonResponse({
          workflow_runs: [
            {
              name: 'Kimi Builder',
              head_branch: 'feature/issue-18-thread-posts',
              html_url: 'https://github.com/ryanvig/Looped/actions/runs/88',
              conclusion: 'success',
              pull_requests: [
                {
                  number: 88,
                  html_url: 'https://github.com/ryanvig/Looped/pull/88',
                },
              ],
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          number: 18,
          title: 'Issue 18',
          html_url: 'https://github.com/ryanvig/Looped/issues/18',
          labels: [{ name: 'build:ready' }],
        })
      );

    await pollGitHubState(fetchMock as typeof fetch);

    expect(ConvexWriter.upsertPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        prNumber: 88,
        status: 'approved',
        hasDesignReview: true,
        hasEngineeringReview: true,
        ciStatus: 'passing',
        issueNumber: 18,
      })
    );
    expect(ConvexWriter.upsertBuildEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        issueNumber: 18,
        status: 'pr_opened',
      })
    );

    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(
      pollGitHubState(fetchMock as typeof fetch)
    ).resolves.toBeUndefined();
  });

  it('seeds agents on startup and configures interval polling', async () => {
    await seedAgentStatus();
    expect(ConvexWriter.upsertAgentStatus).toHaveBeenCalledTimes(8);

    const unref = jest.fn();
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue({ unref } as unknown as NodeJS.Timeout);

    startBackgroundPolling(fetchMock as typeof fetch);

    expect(setIntervalSpy).toHaveBeenCalled();
    expect(unref).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
