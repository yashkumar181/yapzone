import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreate = mutation({
  args: { otherUserId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const myId = identity.subject;
    const otherId = args.otherUserId;

    // 1. Check if conversation exists where I am participantOne
    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", myId))
      .filter((q) => q.eq(q.field("participantTwo"), otherId))
      .first();

    if (conv1) return conv1._id;

    // 2. Check if conversation exists where I am participantTwo
    const conv2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantOne", (q) => q.eq("participantOne", otherId))
      .filter((q) => q.eq(q.field("participantTwo"), myId))
      .first();

    if (conv2) return conv2._id;

    // 3. If no conversation exists, create a new one!
    return await ctx.db.insert("conversations", {
      participantOne: myId,
      participantTwo: otherId,
    });
  },
});