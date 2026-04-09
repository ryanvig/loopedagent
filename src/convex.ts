const CONVEX_URL = process.env.CONVEX_URL?.trim();

async function convexMutation(
  name: string,
  args: Record<string, unknown>
): Promise<void> {
  if (!CONVEX_URL) {
    return;
  }

  try {
    const response = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: name, args }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Convex] mutation ${name} failed: ${response.status} ${text}`
      );
    }
  } catch (err) {
    console.error('[Convex] mutation error:', { name, err });
  }
}

async function convexQuery<T>(
  name: string,
  args: Record<string, unknown>
): Promise<T | null> {
  if (!CONVEX_URL) {
    return null;
  }

  try {
    const response = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: name, args }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Convex] query ${name} failed: ${response.status} ${text}`
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    console.error('[Convex] query error:', { name, err });
    return null;
  }
}

export interface StoredDesignReview {
  _id: string;
  prNumber: string;
  prTitle: string;
  prRepo: string;
  prBranch?: string;
  figmaVariantA?: string;
  figmaVariantB?: string;
  figmaVariantC?: string;
  status: string;
  selectedVariant?: string;
  createdAt: number;
}

export const ConvexWriter = {
  async upsertBuildEvent(args: {
    issueNumber: number;
    issueTitle: string;
    issueUrl: string;
    status:
      | 'queued'
      | 'building'
      | 'testing'
      | 'pr_opened'
      | 'failed'
      | 'completed';
    branch?: string;
    prUrl?: string;
    prNumber?: number;
    agentName: 'kimi-builder';
    logs?: string;
  }) {
    await convexMutation('mutations:upsertBuildEvent', {
      ...args,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async upsertAgentStatus(args: {
    agentId: string;
    agentName: string;
    role: string;
    status: 'idle' | 'active' | 'blocked' | 'offline';
    lastAction: string;
    currentTask?: string;
    links: Array<{ label: string; url: string }>;
  }) {
    await convexMutation('mutations:upsertAgentStatus', {
      ...args,
      lastActionAt: Date.now(),
    });
  },

  async upsertPullRequest(args: {
    prNumber: number;
    prTitle: string;
    prUrl: string;
    branch: string;
    status:
      | 'open'
      | 'review_requested'
      | 'changes_requested'
      | 'approved'
      | 'merged'
      | 'closed';
    author: string;
    hasDesignReview: boolean;
    hasEngineeringReview: boolean;
    ciStatus: 'pending' | 'passing' | 'failing';
    issueNumber?: number;
  }) {
    await convexMutation('mutations:upsertPullRequest', {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async insertKnowledgeHealth(args: {
    status: 'current' | 'drift_detected' | 'error';
    driftSummary: string[];
    filesChanged: string[];
    nextCheckAt?: number;
  }) {
    await convexMutation('mutations:insertKnowledgeHealth', {
      ...args,
      checkRunAt: Date.now(),
    });
  },

  async upsertProductionHealth(args: {
    service: string;
    status: 'healthy' | 'degraded' | 'down' | 'rolled_back';
    errorRate?: number;
    deploymentId?: string;
    lastDeployAt?: number;
    sentryAlerts: number;
  }) {
    await convexMutation('mutations:upsertProductionHealth', {
      ...args,
      recordedAt: Date.now(),
    });
  },

  async createDesignReview(args: {
    prNumber: string;
    prTitle: string;
    prRepo: string;
    prBranch?: string;
  }) {
    await convexMutation('designReviews:create', args);
  },

  async getLatestPendingDesignReview(): Promise<StoredDesignReview | null> {
    return convexQuery<StoredDesignReview>(
      'designReviews:getLatestPending',
      {}
    );
  },

  async getDesignReviewByPrNumber(
    prNumber: string
  ): Promise<StoredDesignReview | null> {
    return convexQuery<StoredDesignReview>('designReviews:getByPrNumber', {
      prNumber,
    });
  },

  async updateSelectedDesignReview(args: {
    id: string;
    selectedVariant: string;
  }) {
    await convexMutation('designReviews:updateSelected', args);
  },

  async updateDesignReviewFigmaLinks(args: {
    id: string;
    figmaVariantA?: string;
    figmaVariantB?: string;
    figmaVariantC?: string;
  }) {
    await convexMutation('designReviews:updateFigmaLinks', args);
  },
};
