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

    // Filter out any messages where my ID is in the deletedFor array
    return messages.filter((msg) => !msg.deletedFor?.includes(identity.subject));
  },
});

export const send = mutation({
  args: { 
    conversationId: v.id("conversations"), 
    content: v.string(),
    replyTo: v.optional(v.id("messages")), 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const senderClerkId = identity.subject;
    const conv = await ctx.db.get(args.conversationId);
    
    if (!conv) {
      throw new Error("Conversation not found");
    }

    // --- NEW: BLOCK CHECK LOGIC ---
    // We only check for blocking in 1-on-1 DMs, not group chats
    if (!conv.isGroup) {
      const otherUserClerkId = conv.participantOne === senderClerkId ? conv.participantTwo : conv.participantOne;

      if (otherUserClerkId) {
        // Fetch both the sender and the receiver's user documents
        const [senderUser, receiverUser] = await Promise.all([
          ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", senderClerkId)).first(),
          ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", otherUserClerkId)).first()
        ]);

        // 1. Did I block them?
        if (senderUser?.blockedUsers?.includes(otherUserClerkId)) {
          throw new Error("You have blocked this user. Unblock them to send messages.");
        }

        // 2. Did they block me?
        if (receiverUser?.blockedUsers?.includes(senderClerkId)) {
          throw new Error("You cannot send a message to this user.");
        }
      }
    }
    // --- END BLOCK CHECK LOGIC ---

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: senderClerkId,
      content: args.content,
      replyTo: args.replyTo, 
    });

    if (conv.participantOne === senderClerkId) {
      await ctx.db.patch(args.conversationId, { participantOneLastRead: Date.now() });
    } else if (conv.participantTwo === senderClerkId) {
      await ctx.db.patch(args.conversationId, { participantTwoLastRead: Date.now() });
    }

    return messageId;
  },
});

export const remove = mutation({
  args: { 
    messageId: v.id("messages"),
    type: v.union(v.literal("for_me"), v.literal("for_everyone")) 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    if (args.type === "for_everyone") {
      if (msg.senderId !== identity.subject) {
        throw new Error("You can only delete your own messages for everyone");
      }
      await ctx.db.patch(args.messageId, {
        isDeleted: true,
        content: "", 
      });
    } else {
      const deletedFor = msg.deletedFor || [];
      if (!deletedFor.includes(identity.subject)) {
        await ctx.db.patch(args.messageId, {
          deletedFor: [...deletedFor, identity.subject],
        });
      }
    }
  },
});

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

    const myReactions = currentReactions.filter((r) => r.userId === myId);
    const hasReactedWithThisEmoji = myReactions.some((r) => r.emoji === args.emoji);

    let newReactions = [...currentReactions];

    if (hasReactedWithThisEmoji) {
      newReactions = newReactions.filter(
        (r) => !(r.userId === myId && r.emoji === args.emoji)
      );
    } else {
      if (myReactions.length >= 2) {
        const oldestEmojiOfMine = myReactions[0].emoji;
        newReactions = newReactions.filter(
          (r) => !(r.userId === myId && r.emoji === oldestEmojiOfMine)
        );
      }
      newReactions.push({ userId: myId, emoji: args.emoji });
    }

    await ctx.db.patch(args.messageId, { reactions: newReactions });
  },
});

export const edit = mutation({
  args: { 
    messageId: v.id("messages"), 
    newContent: v.string() 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    if (message.senderId !== identity.subject) {
      throw new Error("You can only edit your own messages");
    }

    if (message.isDeleted) {
      throw new Error("Cannot edit a deleted message");
    }

    await ctx.db.patch(args.messageId, { 
      content: args.newContent.trim(),
      isEdited: true 
    });
  },
});