import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  buildEvents: defineTable({
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
  })
    .index('by_issueNumber', ['issueNumber'])
    .index('by_status', ['status'])
    .index('by_updated', ['updatedAt']),

  agentStatus: defineTable({
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
  }).index('by_agent', ['agentId']),

  pullRequests: defineTable({
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
  })
    .index('by_prNumber', ['prNumber'])
    .index('by_status', ['status'])
    .index('by_updated', ['updatedAt']),

  knowledgeHealth: defineTable({
    checkRunAt: v.number(),
    status: v.union(
      v.literal('current'),
      v.literal('drift_detected'),
      v.literal('error')
    ),
    driftSummary: v.array(v.string()),
    filesChanged: v.array(v.string()),
    nextCheckAt: v.optional(v.number()),
  }).index('by_checkRunAt', ['checkRunAt']),

  productionHealth: defineTable({
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
  }).index('by_service', ['service']),

  backlog: defineTable({
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
  })
    .index('by_issueNumber', ['issueNumber'])
    .index('by_status', ['status'])
    .index('by_priority', ['priority']),
});
