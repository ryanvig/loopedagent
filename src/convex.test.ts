describe('ConvexWriter', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.CONVEX_URL;
    global.fetch = fetchMock as typeof fetch;
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

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes all supported event types through the Convex HTTP API', async () => {
    process.env.CONVEX_URL = 'https://convex.example';
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '',
    } as Response);

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
    await ConvexWriter.createDesignReview({
      prNumber: '44',
      prTitle: 'Design review',
      prRepo: 'ryanvig/Looped',
      prBranch: 'feature/issue-44-design-review',
    });
    await ConvexWriter.updateSelectedDesignReview({
      id: 'design-review-44',
      selectedVariant: 'B',
    });
    await ConvexWriter.updateDesignReviewFigmaLinks({
      id: 'design-review-44',
      figmaVariantA: 'https://figma.example/a',
      figmaVariantB: 'https://figma.example/b',
    });
    await ConvexWriter.getLatestPendingDesignReview();
    await ConvexWriter.getDesignReviewByPrNumber('44');

    expect(fetchMock.mock.calls).toEqual([
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"path":"mutations:upsertBuildEvent"'),
        }),
      ],
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          body: expect.stringContaining('"path":"mutations:upsertAgentStatus"'),
        }),
      ],
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          body: expect.stringContaining('"path":"mutations:upsertPullRequest"'),
        }),
      ],
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          body: expect.stringContaining(
            '"path":"mutations:insertKnowledgeHealth"'
          ),
        }),
      ],
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          body: expect.stringContaining(
            '"path":"mutations:upsertProductionHealth"'
          ),
        }),
      ],
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          body: expect.stringContaining('"path":"designReviews:create"'),
        }),
      ],
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          body: expect.stringContaining('"path":"designReviews:updateSelected"'),
        }),
      ],
      [
        'https://convex.example/api/mutation',
        expect.objectContaining({
          body: expect.stringContaining(
            '"path":"designReviews:updateFigmaLinks"'
          ),
        }),
      ],
      [
        'https://convex.example/api/query',
        expect.objectContaining({
          body: expect.stringContaining('"path":"designReviews:getLatestPending"'),
        }),
      ],
      [
        'https://convex.example/api/query',
        expect.objectContaining({
          body: expect.stringContaining('"path":"designReviews:getByPrNumber"'),
        }),
      ],
    ]);
  });

  it('logs non-ok Convex mutation responses', async () => {
    process.env.CONVEX_URL = 'https://convex.example';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'broken',
    } as Response);
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
      '[Convex] mutation mutations:upsertBuildEvent failed: 500 broken'
    );

    consoleError.mockRestore();
  });

  it('swallows fetch errors and logs them', async () => {
    process.env.CONVEX_URL = 'https://convex.example';
    fetchMock.mockRejectedValueOnce(new Error('boom'));
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
      '[Convex] mutation error:',
      expect.objectContaining({
        name: 'mutations:upsertBuildEvent',
        err: expect.any(Error),
      })
    );

    consoleError.mockRestore();
  });

  it('logs non-ok Convex query responses and returns null', async () => {
    process.env.CONVEX_URL = 'https://convex.example';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'broken-query',
    } as Response);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { ConvexWriter } = await import('./convex');
    const result = await ConvexWriter.getLatestPendingDesignReview();

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      '[Convex] query designReviews:getLatestPending failed: 500 broken-query'
    );

    consoleError.mockRestore();
  });
});
