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

// IN YOUR convex/messages.ts
export const send = mutation({
  args: { 
    conversationId: v.id("conversations"), 
    content: v.string(),
    replyTo: v.optional(v.id("messages")), // NEW: Accept the reply ID
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: identity.subject,
      content: args.content,
      replyTo: args.replyTo, // NEW: Save it to the database
    });

    // (Keep your existing participantOneLastRead / participantTwoLastRead update logic down here)
    const conv = await ctx.db.get(args.conversationId);
    if (conv) {
      if (conv.participantOne === identity.subject) {
        await ctx.db.patch(args.conversationId, { participantOneLastRead: Date.now() });
      } else if (conv.participantTwo === identity.subject) {
        await ctx.db.patch(args.conversationId, { participantTwoLastRead: Date.now() });
      }
    }

    return messageId;
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

// Add to the bottom of convex/messages.ts

export const react = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    const currentReactions = msg.reactions || [];
    const myId = identity.subject;

    // 1. Get ONLY my current reactions (preserves the order I added them)
    const myReactions = currentReactions.filter((r) => r.userId === myId);

    // 2. Check if I already reacted with THIS specific emoji
    const hasReactedWithThisEmoji = myReactions.some((r) => r.emoji === args.emoji);

    let newReactions = [...currentReactions];

    if (hasReactedWithThisEmoji) {
      // TOGGLE OFF: Remove this specific emoji for this user
      newReactions = newReactions.filter(
        (r) => !(r.userId === myId && r.emoji === args.emoji)
      );
    } else {
      // TOGGLE ON: Add the new emoji
      if (myReactions.length >= 2) {
        // I already have 2 reactions! Remove my oldest one first.
        const oldestEmojiOfMine = myReactions[0].emoji;
        newReactions = newReactions.filter(
          (r) => !(r.userId === myId && r.emoji === oldestEmojiOfMine)
        );
      }
      
      // Add the new reaction to the end
      newReactions.push({ userId: myId, emoji: args.emoji });
    }

    await ctx.db.patch(args.messageId, { reactions: newReactions });
  },
});