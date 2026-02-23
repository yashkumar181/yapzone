import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastSeen: v.optional(v.number()),
  }).index("by_clerkId", ["clerkId"]),

  // NEW: A table for 1-on-1 chats between two users
  conversations: defineTable({
    participantOne: v.string(), // Clerk ID of user 1
    participantTwo: v.string(), // Clerk ID of user 2
    participantOneLastRead: v.optional(v.number()), // NEW
    participantTwoLastRead: v.optional(v.number()), // NEW
  })
    .index("by_participantOne", ["participantOne"])
    .index("by_participantTwo", ["participantTwo"]),

  // NEW: A table for the actual messages inside a conversation
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(), // Clerk ID of the sender
    content: v.string(),
    isDeleted: v.optional(v.boolean()), // NEW: Soft delete flag
  }).index("by_conversationId", ["conversationId"]),
 
  // NEW: Track who is typing, where, and when it expires
  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    userId: v.string(),
    expiresAt: v.number(),
  }).index("by_conversationId", ["conversationId"]),
});

