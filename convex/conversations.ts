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

    // Check if conversation already exists (and ensure it's not a group)
    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", myId))
      .filter((q) => q.eq(q.field("participantTwo"), otherId))
      .filter((q) => q.neq(q.field("isGroup"), true))
      .first();

    if (conv1) return conv1._id;

    const conv2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", otherId))
      .filter((q) => q.eq(q.field("participantTwo"), myId))
      .filter((q) => q.neq(q.field("isGroup"), true))
      .first();

    if (conv2) return conv2._id;

    // Initialize with current time so you don't have "unread" messages from before you existed
    return await ctx.db.insert("conversations", {
      participantOne: myId,
      participantTwo: otherId,
      participantOneLastRead: Date.now(),
      participantTwoLastRead: Date.now(),
      isGroup: false, // Explicitly declare this is not a group
    });
  },
});

// List Conversations with Unread Counts (UPGRADED FOR GROUPS)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const myId = identity.subject;

    // 1. Fetch 1-on-1 chats
    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", myId))
      .collect();

    const conv2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantTwo", (q) => q.eq("participantTwo", myId))
      .collect();

    // 2. Fetch Group chats
    const allGroups = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("isGroup"), true))
      .collect();
    
    const myGroups = allGroups.filter(group => 
      group.groupMembers?.includes(myId)
    );

    // Combine and remove any accidental duplicates
    const allConversations = [...conv1, ...conv2, ...myGroups].filter(
      (v, i, a) => a.findIndex((t) => t._id === v._id) === i
    );

    const enrichedConversations = await Promise.all(
      allConversations.map(async (conv) => {
        // Handle Group Chat enrichment
        if (conv.isGroup) {
           const lastMessage = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
            .order("desc")
            .first();

            // Fetch profiles for all members so we can stack their avatars
            const memberProfiles = await Promise.all(
              (conv.groupMembers || []).map(async (memberId) => {
                return await ctx.db
                  .query("users")
                  .withIndex("by_clerkId", (q) => q.eq("clerkId", memberId))
                  .first();
              })
            );

            return {
              _id: conv._id,
              isGroup: true,
              groupName: conv.groupName,
              groupMembers: memberProfiles.filter(Boolean), 
              otherUser: undefined, // Force shape consistency for TypeScript
              lastMessage,
              unreadCount: 0, 
              _creationTime: conv._creationTime,
            };
        }

        // Handle 1-on-1 Chat enrichment (Legacy)
        const otherUserId = conv.participantOne === myId ? conv.participantTwo : conv.participantOne;
        const myLastRead = conv.participantOne === myId 
          ? conv.participantOneLastRead || 0 
          : conv.participantTwoLastRead || 0;

        const otherUser = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", otherUserId as string))
          .first();

        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();

        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
          .filter((q) => 
            q.and(
              q.gt(q.field("_creationTime"), myLastRead),
              q.neq(q.field("senderId"), myId)
            )
          )
          .collect();

        return {
          _id: conv._id,
          isGroup: false,
          groupName: undefined, // Force shape consistency for TypeScript
          groupMembers: undefined, // Force shape consistency for TypeScript
          otherUser,
          lastMessage,
          unreadCount: unreadMessages.length,
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

    if (conv.isGroup) return; // Skip read logic for groups right now

    // Update ONLY my field
    if (conv.participantOne === myId) {
      await ctx.db.patch(args.conversationId, { participantOneLastRead: Date.now() });
    } else if (conv.participantTwo === myId) {
      await ctx.db.patch(args.conversationId, { participantTwoLastRead: Date.now() });
    }
  },
});

// NEW: Create a multi-user group chat
export const createGroup = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.string()), // Must include the creator's ID too!
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const myId = identity.subject;

    // Ensure the creator is in the member list
    const finalMembers = args.memberIds.includes(myId) 
      ? args.memberIds 
      : [...args.memberIds, myId];

    return await ctx.db.insert("conversations", 
      {
      isGroup: true,
      groupName: args.name,
      groupMembers: finalMembers,
      groupAdmin: myId,
    });
  },
});

// NEW: Fetch details for a specific group
export const getGroupDetails = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.isGroup) return null;
    return conv;
  },
});

// NEW: Leave a group chat
export const leaveGroup = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const myId = identity.subject;
    const conv = await ctx.db.get(args.conversationId);
    
    if (!conv || !conv.isGroup) throw new Error("Not a group");

    // Remove my ID from the members array
    const updatedMembers = (conv.groupMembers || []).filter((id) => id !== myId);

    await ctx.db.patch(args.conversationId, {
      groupMembers: updatedMembers,
    });
  },
});