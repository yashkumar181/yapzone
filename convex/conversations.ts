import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create or Fetch a Chat
export const getOrCreate = mutation({
  args: { otherUserId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const myId = identity.subject;
    const otherId = args.otherUserId;

    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", myId))
      .filter((q) => q.eq(q.field("participantTwo"), otherId))
      .first();

    if (conv1) return conv1._id;

    const conv2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", otherId))
      .filter((q) => q.eq(q.field("participantTwo"), myId))
      .first();

    if (conv2) return conv2._id;

    // Initialize with current time so you don't have "unread" messages from before you existed
    return await ctx.db.insert("conversations", {
      participantOne: myId,
      participantTwo: otherId,
      participantOneLastRead: Date.now(),
      participantTwoLastRead: Date.now(),
    });
  },
});

// List Conversations with Unread Counts
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const myId = identity.subject;

    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", myId))
      .collect();

    const conv2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantTwo", (q) => q.eq("participantTwo", myId))
      .collect();

    const allConversations = [...conv1, ...conv2];

    const enrichedConversations = await Promise.all(
      allConversations.map(async (conv) => {
        const otherUserId = conv.participantOne === myId ? conv.participantTwo : conv.participantOne;
        
        // Determine my last read time
        const myLastRead = conv.participantOne === myId 
          ? conv.participantOneLastRead || 0 
          : conv.participantTwoLastRead || 0;

        const otherUser = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", otherUserId))
          .first();

        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();

        // Calculate unread count: Messages in this chat, created AFTER myLastRead, sent by NOT me
        // Calculate unread count: Messages in this chat, created AFTER myLastRead, sent by NOT me
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
          // FIXED: We must use q.and() instead of standard &&
          .filter((q) => 
            q.and(
              q.gt(q.field("_creationTime"), myLastRead),
              q.neq(q.field("senderId"), myId)
            )
          )
          .collect();

        return {
          _id: conv._id,
          otherUser,
          lastMessage,
          unreadCount: unreadMessages.length, // Include the count!
          _creationTime: conv._creationTime,
        };
      })
    );

    return enrichedConversations.sort((a, b) => {
      const aTime = a.lastMessage?._creationTime || a._creationTime;
      const bTime = b.lastMessage?._creationTime || b._creationTime;
      return bTime - aTime;
    });
  },
});

// NEW: Mark a conversation as read
export const markAsRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");

    const myId = identity.subject;

    // Update ONLY my field
    if (conv.participantOne === myId) {
      await ctx.db.patch(args.conversationId, { participantOneLastRead: Date.now() });
    } else if (conv.participantTwo === myId) {
      await ctx.db.patch(args.conversationId, { participantTwoLastRead: Date.now() });
    }
  },
});