import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    prNumber: v.string(),
    prTitle: v.string(),
    prRepo: v.string(),
    prBranch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('designReviews', {
      ...args,
      status: 'pending',
      createdAt: Date.now(),
    });
  },
});

export const getLatestPending = query({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db
      .query('designReviews')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .order('desc')
      .take(1);
    return reviews[0] || null;
  },
});

export const getByPrNumber = query({
  args: { prNumber: v.string() },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('designReviews')
      .withIndex('by_pr_number', (q) => q.eq('prNumber', args.prNumber))
      .order('desc')
      .take(1);
    return reviews[0] || null;
  },
});

export const updateSelected = mutation({
  args: {
    id: v.id('designReviews'),
    selectedVariant: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: 'selected',
      selectedVariant: args.selectedVariant,
    });
  },
});

export const updateFigmaLinks = mutation({
  args: {
    id: v.id('designReviews'),
    figmaVariantA: v.optional(v.string()),
    figmaVariantB: v.optional(v.string()),
    figmaVariantC: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});
