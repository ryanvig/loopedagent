import type { Mock } from 'jest-mock';

describe('ConvexWriter', () => {
  const mutation = jest.fn();
  const ConvexHttpClient = jest.fn().mockImplementation(() => ({ mutation }));

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.CONVEX_URL;

    jest.doMock('convex/browser', () => ({
      ConvexHttpClient,
    }));
    jest.doMock('../convex/_generated/api', () => ({
      api: {
        mutations: {
          upsertBuildEvent: 'upsertBuildEventRef',
          upsertAgentStatus: 'upsertAgentStatusRef',
          upsertPullRequest: 'upsertPullRequestRef',
          insertKnowledgeHealth: 'insertKnowledgeHealthRef',
          upsertProductionHealth: 'upsertProductionHealthRef',
        },
      },
    }));
  });

  it('no-ops when CONVEX_URL is not configured', async () => {
    const { ConvexWriter } = await import('./convex');

    await ConvexWriter.upsertBuildEvent({
      issueNumber: 1,
      issueTitle: 'Issue 1',
      issueUrl: 'https://example.com/issues/1',
      status: 'queued',
      agentName: 'kimi-builder',
    });

    expect(ConvexHttpClient).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });

  it('writes all supported event types through the Convex client', async () => {
    process.env.CONVEX_URL = 'https://convex.example';
    const { ConvexWriter } = await import('./convex');

    await ConvexWriter.upsertBuildEvent({
      issueNumber: 12,
      issueTitle: 'Thread moderation',
      issueUrl: 'https://example.com/issues/12',
      status: 'building',
      branch: 'feature/issue-12-thread-moderation',
      agentName: 'kimi-builder',
    });
    await ConvexWriter.upsertAgentStatus({
      agentId: 'kimi-builder',
      agentName: 'Kimi Code Builder',
      role: 'Builder',
      status: 'active',
      lastAction: 'Building issue #12',
      currentTask: 'feature/issue-12-thread-moderation',
      links: [{ label: 'Run', url: 'https://example.com/run/12' }],
    });
    await ConvexWriter.upsertPullRequest({
      prNumber: 44,
      prTitle: 'Add thread moderation',
      prUrl: 'https://example.com/pulls/44',
      branch: 'feature/issue-12-thread-moderation',
      status: 'review_requested',
      author: 'ryanvig',
      hasDesignReview: false,
      hasEngineeringReview: true,
      ciStatus: 'pending',
      issueNumber: 12,
    });
    await ConvexWriter.insertKnowledgeHealth({
      status: 'current',
      driftSummary: [],
      filesChanged: [],
    });
    await ConvexWriter.upsertProductionHealth({
      service: 'production',
      status: 'healthy',
      sentryAlerts: 0,
    });

    expect(ConvexHttpClient).toHaveBeenCalledWith('https://convex.example');
    expect((mutation as Mock).mock.calls).toEqual([
      [
        'upsertBuildEventRef',
        expect.objectContaining({
          issueNumber: 12,
          status: 'building',
          startedAt: expect.any(Number),
          updatedAt: expect.any(Number),
        }),
      ],
      [
        'upsertAgentStatusRef',
        expect.objectContaining({
          agentId: 'kimi-builder',
          lastActionAt: expect.any(Number),
        }),
      ],
      [
        'upsertPullRequestRef',
        expect.objectContaining({
          prNumber: 44,
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        }),
      ],
      [
        'insertKnowledgeHealthRef',
        expect.objectContaining({
          status: 'current',
          checkRunAt: expect.any(Number),
        }),
      ],
      [
        'upsertProductionHealthRef',
        expect.objectContaining({
          service: 'production',
          recordedAt: expect.any(Number),
        }),
      ],
    ]);
  });

  it('swallows Convex client errors and logs them', async () => {
    process.env.CONVEX_URL = 'https://convex.example';
    mutation.mockRejectedValueOnce(new Error('boom'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { ConvexWriter } = await import('./convex');
    await ConvexWriter.upsertBuildEvent({
      issueNumber: 99,
      issueTitle: 'Broken event',
      issueUrl: 'https://example.com/issues/99',
      status: 'failed',
      agentName: 'kimi-builder',
    });

    expect(consoleError).toHaveBeenCalledWith(
      '[Convex] upsertBuildEvent failed:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
