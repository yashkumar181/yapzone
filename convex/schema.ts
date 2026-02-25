import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastSeen: v.optional(v.number()),
    blockedUsers: v.optional(v.array(v.string())),
  }).index("by_clerkId", ["clerkId"]),

  conversations: defineTable({
    participantOne: v.optional(v.string()), 
    participantTwo: v.optional(v.string()), 
    participantOneLastRead: v.optional(v.number()),
    participantTwoLastRead: v.optional(v.number()),
    isGroup: v.optional(v.boolean()),
    groupName: v.optional(v.string()),
    groupDescription: v.optional(v.string()), // NEW: Added Description
    groupImageUrl: v.optional(v.string()),    // NEW: Added PFP URL
    groupMembers: v.optional(v.array(v.string())),
    groupAdmin: v.optional(v.string()),
    pastMembers: v.optional(v.array(v.string())), 
    deletedBy: v.optional(v.array(v.string())),
    memberLastRead: v.optional(
      v.array(
        v.object({
          userId: v.string(),
          lastRead: v.number(),
        })
      )
    ),
  })
    .index("by_participantOne", ["participantOne"])
    .index("by_participantTwo", ["participantTwo"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    content: v.string(),
    replyTo: v.optional(v.id("messages")),
    isDeleted: v.optional(v.boolean()),
    isEdited: v.optional(v.boolean()), // NEW: Added this line!
    deletedFor: v.optional(v.array(v.string())),
    reactions: v.optional(
      v.array(
        v.object({
          userId: v.string(),
          emoji: v.string(),
        })
      )
    ),
  }).index("by_conversationId", ["conversationId"]),
  
  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    userId: v.string(),
    expiresAt: v.number(),
  }).index("by_conversationId", ["conversationId"]),
});