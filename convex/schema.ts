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
  })
    .index("by_participantOne", ["participantOne"])
    .index("by_participantTwo", ["participantTwo"]),

  // NEW: A table for the actual messages inside a conversation
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(), // Clerk ID of the sender
    content: v.string(),
  }).index("by_conversationId", ["conversationId"]),
});