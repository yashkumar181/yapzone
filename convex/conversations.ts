import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// EXISTING: Creates or fetches a chat when you click a user
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

    return await ctx.db.insert("conversations", {
      participantOne: myId,
      participantTwo: otherId,
    });
  },
});

// NEW: Fetches all active conversations with user details and the latest message
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const myId = identity.subject;

    // 1. Get all conversations where I am participantOne
    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", myId))
      .collect();

    // 2. Get all conversations where I am participantTwo
    const conv2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantTwo", (q) => q.eq("participantTwo", myId))
      .collect();

    const allConversations = [...conv1, ...conv2];

    // 3. For every conversation, fetch the other user's profile AND the last message
    const enrichedConversations = await Promise.all(
      allConversations.map(async (conv) => {
        // Figure out who the *other* person is
        const otherUserId = conv.participantOne === myId ? conv.participantTwo : conv.participantOne;

        // Grab their profile from the users table
        const otherUser = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", otherUserId))
          .first();

        // Grab the absolute newest message in this conversation
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
          .order("desc") // Sorts newest to oldest
          .first(); // Grabs just the top one

        return {
          _id: conv._id,
          otherUser,
          lastMessage,
          _creationTime: conv._creationTime,
        };
      })
    );

    // 4. Sort the sidebar so the chat with the most recent message is at the top
    return enrichedConversations.sort((a, b) => {
      const aTime = a.lastMessage?._creationTime || a._creationTime;
      const bTime = b.lastMessage?._creationTime || b._creationTime;
      return bTime - aTime;
    });
  },
});