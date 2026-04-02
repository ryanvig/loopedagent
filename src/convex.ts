import { ConvexHttpClient } from 'convex/browser';

import { api } from '../convex/_generated/api';

let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient | null {
  const convexUrl = process.env.CONVEX_URL?.trim();
  if (!convexUrl) {
    return null;
  }

  if (!client) {
    client = new ConvexHttpClient(convexUrl);
  }

  return client;
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
    try {
      const c = getClient();
      if (!c) return;
      await c.mutation(api.mutations.upsertBuildEvent, {
        ...args,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('[Convex] upsertBuildEvent failed:', err);
    }
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
    try {
      const c = getClient();
      if (!c) return;
      await c.mutation(api.mutations.upsertAgentStatus, {
        ...args,
        lastActionAt: Date.now(),
      });
    } catch (err) {
      console.error('[Convex] upsertAgentStatus failed:', err);
    }
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
    try {
      const c = getClient();
      if (!c) return;
      await c.mutation(api.mutations.upsertPullRequest, {
        ...args,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('[Convex] upsertPullRequest failed:', err);
    }
  },

  async insertKnowledgeHealth(args: {
    status: 'current' | 'drift_detected' | 'error';
    driftSummary: string[];
    filesChanged: string[];
    nextCheckAt?: number;
  }) {
    try {
      const c = getClient();
      if (!c) return;
      await c.mutation(api.mutations.insertKnowledgeHealth, {
        ...args,
        checkRunAt: Date.now(),
      });
    } catch (err) {
      console.error('[Convex] insertKnowledgeHealth failed:', err);
    }
  },

  async upsertProductionHealth(args: {
    service: string;
    status: 'healthy' | 'degraded' | 'down' | 'rolled_back';
    errorRate?: number;
    deploymentId?: string;
    lastDeployAt?: number;
    sentryAlerts: number;
  }) {
    try {
      const c = getClient();
      if (!c) return;
      await c.mutation(api.mutations.upsertProductionHealth, {
        ...args,
        recordedAt: Date.now(),
      });
    } catch (err) {
      console.error('[Convex] upsertProductionHealth failed:', err);
    }
  },
};
