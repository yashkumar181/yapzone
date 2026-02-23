import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List messages, but hide ones the user has deleted for themselves
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    // NEW: Filter out any messages where my ID is in the deletedFor array
    return messages.filter((msg) => !msg.deletedFor?.includes(identity.subject));
  },
});

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

// NEW: Advanced Remove Mutation
export const remove = mutation({
  args: { 
    messageId: v.id("messages"),
    type: v.union(v.literal("for_me"), v.literal("for_everyone")) // Require a type!
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    if (args.type === "for_everyone") {
      // Must be the sender to delete for everyone
      if (msg.senderId !== identity.subject) {
        throw new Error("You can only delete your own messages for everyone");
      }
      await ctx.db.patch(args.messageId, {
        isDeleted: true,
        content: "", // Wipe from database
      });
    } else {
      // Delete for me: Just add my ID to the hidden list
      const deletedFor = msg.deletedFor || [];
      if (!deletedFor.includes(identity.subject)) {
        await ctx.db.patch(args.messageId, {
          deletedFor: [...deletedFor, identity.subject],
        });
      }
    }
  },
});