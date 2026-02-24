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
    
    // UPDATED: Include groups I am currently in OR past groups, UNLESS I deleted it.
    const myGroups = allGroups.filter(group => {
      const isInGroup = group.groupMembers?.includes(myId);
      const isPastMember = group.pastMembers?.includes(myId);
      const isDeletedForMe = group.deletedBy?.includes(myId);

      return (isInGroup || isPastMember) && !isDeletedForMe;
    });

    // Combine and remove any accidental duplicates
    const allConversations = [...conv1, ...conv2, ...myGroups].filter(
      (v, i, a) => a.findIndex((t) => t._id === v._id) === i
    );

    const enrichedConversations = await Promise.all(
      allConversations.map(async (conv) => {
        // Handle Group Chat enrichment
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

            // NEW: Smart Unread Badge Calculation!
            // 1. Find MY specific last read timestamp (default to group creation time if I haven't opened it yet)
            const myReadRecord = (conv.memberLastRead || []).find(r => r.userId === myId);
            const myLastRead = myReadRecord ? myReadRecord.lastRead : conv._creationTime;

            // 2. Count all messages sent AFTER my timestamp (that I didn't send)
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
              isGroup: true,
              groupName: conv.groupName,
              groupMembers: memberProfiles.filter(Boolean), 
              otherUser: undefined, 
              lastMessage,
              unreadCount: unreadMessages.length, // UPDATED: Now dynamically counts!
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
// UPDATED: Mark a conversation as read (Now supports groups!)
export const markAsRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");

    const myId = identity.subject;

    // NEW: Handle Group Chat Read Receipts
    if (conv.isGroup) {
      const currentReceipts = conv.memberLastRead || [];
      // Filter out our old timestamp (if it exists)
      const otherReceipts = currentReceipts.filter(r => r.userId !== myId);
      
      // Add our new timestamp for right NOW
      await ctx.db.patch(args.conversationId, {
        memberLastRead: [...otherReceipts, { userId: myId, lastRead: Date.now() }]
      });
      return;
    }

    // Handle 1-on-1 Chat Read Receipts (Legacy)
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
// UPDATED: Leave a group chat with options
export const leaveGroup = mutation({
  args: { 
    conversationId: v.id("conversations"),
    deleteHistory: v.boolean() // NEW: Did they choose to delete?
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const myId = identity.subject;
    const conv = await ctx.db.get(args.conversationId);
    
    if (!conv || !conv.isGroup) throw new Error("Not a group");

    // Remove my ID from the active members array
    const updatedMembers = (conv.groupMembers || []).filter((id) => id !== myId);

    const patchData: any = {
      groupMembers: updatedMembers,
    };

    // If they delete, add to deletedBy. If they just leave, add to pastMembers.
    if (args.deleteHistory) {
      patchData.deletedBy = [...(conv.deletedBy || []), myId];
    } else {
      patchData.pastMembers = [...(conv.pastMembers || []), myId];
    }

    await ctx.db.patch(args.conversationId, patchData);
  },
});

// NEW: Rename a group (Admin only)
export const renameGroup = mutation({
  args: { 
    conversationId: v.id("conversations"),
    newName: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const myId = identity.subject;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.isGroup) throw new Error("Not a group");
    
    // Security check: Only the admin can rename
    if (conv.groupAdmin !== myId) throw new Error("Only the admin can rename this group");

    await ctx.db.patch(args.conversationId, { groupName: args.newName.trim() });
  },
});

// NEW: Kick a member from the group (Admin only)
export const kickMember = mutation({
  args: { 
    conversationId: v.id("conversations"),
    memberIdToKick: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const myId = identity.subject;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.isGroup) throw new Error("Not a group");
    
    // Security checks
    if (conv.groupAdmin !== myId) throw new Error("Only the admin can kick members");
    if (args.memberIdToKick === myId) throw new Error("You cannot kick yourself");

    // Remove them from active members
    const updatedMembers = (conv.groupMembers || []).filter((id) => id !== args.memberIdToKick);
    // Add them to past members so they keep their read-only history
    const updatedPastMembers = [...(conv.pastMembers || []), args.memberIdToKick];

    await ctx.db.patch(args.conversationId, {
      groupMembers: updatedMembers,
      pastMembers: updatedPastMembers,
    });
  },
});
