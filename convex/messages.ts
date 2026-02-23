import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Real-time query to get all messages in a chat
export const list = query({
  args: { conversationId: v.optional(v.id("conversations")) },
  handler: async (ctx, args) => {
    // 1. Extract to a local variable to help TypeScript's type checker
    const chatId = args.conversationId;

    // 2. If it's undefined, return early
    if (!chatId) return [];
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("messages")
      // 3. Use the local variable here! No more TS errors.
      .withIndex("by_conversationId", (q) => q.eq("conversationId", chatId))
      .collect();
  },
});

// Mutation to send a new message
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: identity.subject,
      content: args.content,
    });
  },
  
});

// Add to the bottom of convex/messages.ts

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 1. Fetch the message
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    // 2. SECURITY CHECK: Ensure the person deleting it actually sent it
    if (msg.senderId !== identity.subject) {
      throw new Error("You can only delete your own messages");
    }

    // 3. Perform the Soft Delete
    await ctx.db.patch(args.messageId, {
      isDeleted: true,
      content: "", // Optional: Clear the content from the DB for privacy
    });
  },
});