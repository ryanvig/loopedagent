/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from 'convex/values';

import { mutation } from './_generated/server';

async function upsertByIndex(
  ctx: any,
  table: string,
  indexName: string,
  fieldName: string,
  fieldValue: string | number,
  value: Record<string, unknown>
) {
  const existing = await ctx.db
    .query(table)
    .withIndex(indexName, (q: any) => q.eq(fieldName, fieldValue))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, value);
    return existing._id;
  }

  return ctx.db.insert(table, value);
}

export const upsertBuildEvent = mutation({
  args: {
    issueNumber: v.number(),
    issueTitle: v.string(),
    issueUrl: v.string(),
    status: v.union(
      v.literal('queued'),
      v.literal('building'),
      v.literal('testing'),
      v.literal('pr_opened'),
      v.literal('failed'),
      v.literal('completed')
    ),
    branch: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    startedAt: v.number(),
    updatedAt: v.number(),
    agentName: v.literal('kimi-builder'),
    logs: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) =>
    upsertByIndex(
      ctx,
      'buildEvents',
      'by_issueNumber',
      'issueNumber',
      args.issueNumber,
      args
    ),
});

export const upsertAgentStatus = mutation({
  args: {
    agentId: v.string(),
    agentName: v.string(),
    role: v.string(),
    status: v.union(
      v.literal('idle'),
      v.literal('active'),
      v.literal('blocked'),
      v.literal('offline')
    ),
    lastAction: v.string(),
    lastActionAt: v.number(),
    currentTask: v.optional(v.string()),
    links: v.array(v.object({ label: v.string(), url: v.string() })),
  },
  handler: async (ctx: any, args: any) =>
    upsertByIndex(
      ctx,
      'agentStatus',
      'by_agent',
      'agentId',
      args.agentId,
      args
    ),
});

export const upsertPullRequest = mutation({
  args: {
    prNumber: v.number(),
    prTitle: v.string(),
    prUrl: v.string(),
    branch: v.string(),
    status: v.union(
      v.literal('open'),
      v.literal('review_requested'),
      v.literal('changes_requested'),
      v.literal('approved'),
      v.literal('merged'),
      v.literal('closed')
    ),
    author: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    hasDesignReview: v.boolean(),
    hasEngineeringReview: v.boolean(),
    ciStatus: v.union(
      v.literal('pending'),
      v.literal('passing'),
      v.literal('failing')
    ),
    issueNumber: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) =>
    upsertByIndex(
      ctx,
      'pullRequests',
      'by_prNumber',
      'prNumber',
      args.prNumber,
      args
    ),
});

export const insertKnowledgeHealth = mutation({
  args: {
    checkRunAt: v.number(),
    status: v.union(
      v.literal('current'),
      v.literal('drift_detected'),
      v.literal('error')
    ),
    driftSummary: v.array(v.string()),
    filesChanged: v.array(v.string()),
    nextCheckAt: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) =>
    ctx.db.insert('knowledgeHealth', args),
});

export const upsertProductionHealth = mutation({
  args: {
    recordedAt: v.number(),
    service: v.string(),
    status: v.union(
      v.literal('healthy'),
      v.literal('degraded'),
      v.literal('down'),
      v.literal('rolled_back')
    ),
    errorRate: v.optional(v.number()),
    deploymentId: v.optional(v.string()),
    lastDeployAt: v.optional(v.number()),
    sentryAlerts: v.number(),
  },
  handler: async (ctx: any, args: any) =>
    upsertByIndex(
      ctx,
      'productionHealth',
      'by_service',
      'service',
      args.service,
      args
    ),
});

export const upsertBacklog = mutation({
  args: {
    issueNumber: v.number(),
    issueTitle: v.string(),
    issueUrl: v.string(),
    agentType: v.union(
      v.literal('engineering'),
      v.literal('design'),
      v.literal('marketing'),
      v.literal('sales')
    ),
    priority: v.number(),
    status: v.union(
      v.literal('backlog'),
      v.literal('ready'),
      v.literal('in_progress'),
      v.literal('done')
    ),
    createdAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) =>
    upsertByIndex(
      ctx,
      'backlog',
      'by_issueNumber',
      'issueNumber',
      args.issueNumber,
      args
    ),
});
