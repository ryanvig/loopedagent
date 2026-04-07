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
};
