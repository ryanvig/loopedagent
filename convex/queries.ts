/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from './_generated/server';

export const getRecentBuildEvents = query({
  args: {},
  handler: async (ctx: any) =>
    ctx.db.query('buildEvents').withIndex('by_updated').order('desc').take(20),
});

export const getAllAgentStatus = query({
  args: {},
  handler: async (ctx: any) => ctx.db.query('agentStatus').collect(),
});

export const getOpenPullRequests = query({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db
      .query('pullRequests')
      .withIndex('by_updated')
      .order('desc')
      .collect();
    return rows.filter(
      (row: any) => row.status === 'open' || row.status === 'review_requested'
    );
  },
});

export const getLatestKnowledgeHealth = query({
  args: {},
  handler: async (ctx: any) =>
    ctx.db
      .query('knowledgeHealth')
      .withIndex('by_checkRunAt')
      .order('desc')
      .first(),
});

export const getProductionHealth = query({
  args: {},
  handler: async (ctx: any) => ctx.db.query('productionHealth').collect(),
});

export const getBacklog = query({
  args: {},
  handler: async (ctx: any) =>
    ctx.db.query('backlog').withIndex('by_priority').order('asc').collect(),
});
