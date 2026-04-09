import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  designReviews: defineTable({
    prNumber: v.string(),
    prTitle: v.string(),
    prRepo: v.string(),
    prBranch: v.optional(v.string()),
    figmaVariantA: v.optional(v.string()),
    figmaVariantB: v.optional(v.string()),
    figmaVariantC: v.optional(v.string()),
    status: v.string(),
    selectedVariant: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_pr_number', ['prNumber'])
    .index('by_status', ['status']),
});
