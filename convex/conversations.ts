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

    return await ctx.db.insert("conversations", {
      participantOne: myId,
      participantTwo: otherId,
      participantOneLastRead: Date.now(),
      participantTwoLastRead: Date.now(),
      isGroup: false, 
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

    // FIXED: Filter out 1-on-1 chats you have deleted!
    const activeConv1 = conv1.filter(c => !c.deletedBy?.includes(myId));
    const activeConv2 = conv2.filter(c => !c.deletedBy?.includes(myId));

    const allGroups = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("isGroup"), true))
      .collect();
    
    const myGroups = allGroups.filter(group => {
      const isInGroup = group.groupMembers?.includes(myId);
      const isPastMember = group.pastMembers?.includes(myId);
      const isDeletedForMe = group.deletedBy?.includes(myId);
      return (isInGroup || isPastMember) && !isDeletedForMe;
    });

    // FIXED: Combine using the active (filtered) conversations
    const allConversations = [...activeConv1, ...activeConv2, ...myGroups].filter(
      (v, i, a) => a.findIndex((t) => t._id === v._id) === i
    );

    const enrichedConversations = await Promise.all(
      allConversations.map(async (conv) => {
        if (conv.isGroup) {
           const lastMessage = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
            .order("desc")
            .first();

            const memberProfiles = await Promise.all(
              (conv.groupMembers || []).map(async (memberId) => {
                return await ctx.db
                  .query("users")
                  .withIndex("by_clerkId", (q) => q.eq("clerkId", memberId))
                  .first();
              })
            );

            const myReadRecord = (conv.memberLastRead || []).find(r => r.userId === myId);
            const myLastRead = myReadRecord ? myReadRecord.lastRead : conv._creationTime;

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
              groupDescription: conv.groupDescription, 
              groupImageUrl: conv.groupImageUrl,       
              groupMembers: memberProfiles.filter(Boolean), 
              otherUser: undefined, 
              lastMessage,
              unreadCount: unreadMessages.length, 
              _creationTime: conv._creationTime,
            };
        }

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
          groupName: undefined, 
          groupMembers: undefined, 
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

export const markAsRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");

    const myId = identity.subject;

    if (conv.isGroup) {
      const currentReceipts = conv.memberLastRead || [];
      const otherReceipts = currentReceipts.filter(r => r.userId !== myId);
      
      await ctx.db.patch(args.conversationId, {
        memberLastRead: [...otherReceipts, { userId: myId, lastRead: Date.now() }]
      });
      return;
    }

    if (conv.participantOne === myId) {
      await ctx.db.patch(args.conversationId, { participantOneLastRead: Date.now() });
    } else if (conv.participantTwo === myId) {
      await ctx.db.patch(args.conversationId, { participantTwoLastRead: Date.now() });
    }
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.string()), 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const myId = identity.subject;
    const finalMembers = args.memberIds.includes(myId) ? args.memberIds : [...args.memberIds, myId];

    return await ctx.db.insert("conversations", {
      isGroup: true,
      groupName: args.name,
      groupMembers: finalMembers,
      groupAdmin: myId,
    });
  },
});

export const getGroupDetails = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.isGroup) return null;
    return conv;
  },
});

export const leaveGroup = mutation({
  args: { 
    conversationId: v.id("conversations"),
    deleteHistory: v.boolean() 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const myId = identity.subject;
    const conv = await ctx.db.get(args.conversationId);
    
    if (!conv || !conv.isGroup) throw new Error("Not a group");

    const updatedMembers = (conv.groupMembers || []).filter((id) => id !== myId);
    const patchData: any = { groupMembers: updatedMembers };

    if (args.deleteHistory) {
      patchData.deletedBy = [...(conv.deletedBy || []), myId];
    } else {
      patchData.pastMembers = [...(conv.pastMembers || []), myId];
    }

    await ctx.db.patch(args.conversationId, patchData);
  },
});

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
    if (conv.groupAdmin !== myId) throw new Error("Only the admin can rename this group");

    await ctx.db.patch(args.conversationId, { groupName: args.newName.trim() });
  },
});

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
    if (conv.groupAdmin !== myId) throw new Error("Only the admin can kick members");
    if (args.memberIdToKick === myId) throw new Error("You cannot kick yourself");

    const updatedMembers = (conv.groupMembers || []).filter((id) => id !== args.memberIdToKick);
    const updatedPastMembers = [...(conv.pastMembers || []), args.memberIdToKick];

    await ctx.db.patch(args.conversationId, {
      groupMembers: updatedMembers,
      pastMembers: updatedPastMembers,
    });
  },
});

// ==========================================
// NEW: Add Members to Existing Group
// ==========================================
export const addMembers = mutation({
  args: { 
    conversationId: v.id("conversations"),
    newMemberIds: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const myId = identity.subject;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.isGroup) throw new Error("Not a group");
    
    if (conv.groupAdmin !== myId) throw new Error("Only the admin can add members");

    const currentMembers = conv.groupMembers || [];
    const membersToAdd = args.newMemberIds.filter(id => !currentMembers.includes(id));

    await ctx.db.patch(args.conversationId, {
      groupMembers: [...currentMembers, ...membersToAdd],
    });
  },
});

// ==========================================
// NEW: Update Group Details (PFP & Description)
// ==========================================
export const updateGroupDetails = mutation({
  args: { 
    conversationId: v.id("conversations"),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const myId = identity.subject;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.isGroup) throw new Error("Not a group");
    if (conv.groupAdmin !== myId) throw new Error("Only the admin can update details");

    const patchData: any = {};
    if (args.description !== undefined) patchData.groupDescription = args.description;
    if (args.imageUrl !== undefined) patchData.groupImageUrl = args.imageUrl;

    await ctx.db.patch(args.conversationId, patchData);
  },
});

// ==========================================
// NEW: Delete / Hide a Chat
// ==========================================
export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const myId = identity.subject;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");

    // Push the user's ID into the deletedBy array so it hides from their list
    await ctx.db.patch(args.conversationId, {
      deletedBy: [...(conv.deletedBy || []), myId]
    });
  },
});