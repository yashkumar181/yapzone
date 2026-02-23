import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Call this every time the user hits a key
export const start = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const expiresAt = Date.now() + 2500; // Expires in 2.5 seconds

    // Check if we already have an active indicator for this user in this chat
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (existing) {
      // Refresh the timer
      await ctx.db.patch(existing._id, { expiresAt });
    } else {
      // Create a new indicator
      await ctx.db.insert("typingIndicators", {
        conversationId: args.conversationId,
        userId: identity.subject,
        expiresAt,
      });
    }
  },
});

// Call this immediately when a message is sent to clear it early
export const stop = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Real-time query to see if the *other* person is typing
export const getActive = query({
  args: { conversationId: v.optional(v.id("conversations")) },
  handler: async (ctx, args) => {
    // 1. Extract to local variable so TypeScript knows it's safe
    const chatId = args.conversationId;
    
    if (!chatId) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const indicators = await ctx.db
      .query("typingIndicators")
      // 2. Use the local variable (chatId) here instead of args.conversationId
      .withIndex("by_conversationId", (q) => q.eq("conversationId", chatId))
      .collect();

    // Filter out our own typing status AND anything that has expired
    return indicators.filter(
      (indicator) =>
        indicator.userId !== identity.subject &&
        indicator.expiresAt > Date.now()
    );
  },
});