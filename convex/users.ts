import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // Update the user's info in case they changed their avatar/name in Clerk
      return await ctx.db.patch(existingUser._id, {
        name: args.name,
        imageUrl: args.imageUrl,
      });
    }

    // If no user exists, create a new one
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
    });
  },
});

export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    // 1. Get the currently authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return []; // If not logged in, return an empty list
    }

    // 2. Fetch all users from the database
    const users = await ctx.db.query("users").collect();

    // 3. Filter out the current user (identity.subject is their Clerk ID)
    return users.filter((user) => user.clerkId !== identity.subject);
  },
});


export const updatePresence = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    // Find the currently logged-in user in our database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (user) {
      // Update their lastSeen timestamp to right now
      await ctx.db.patch(user._id, { lastSeen: Date.now() });
    }
  },
});

// NEW: Query to get the current logged-in user's full profile
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

// NEW: Mutation to toggle block/unblock a specific user
export const toggleBlockUser = mutation({
  args: {
    clerkIdToToggle: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) throw new Error("User not found");

    const blockedUsers = currentUser.blockedUsers || [];
    let newBlockedUsers;

    if (blockedUsers.includes(args.clerkIdToToggle)) {
      // They are already blocked -> Unblock them
      newBlockedUsers = blockedUsers.filter((id) => id !== args.clerkIdToToggle);
    } else {
      // They are not blocked -> Block them
      newBlockedUsers = [...blockedUsers, args.clerkIdToToggle];
    }

    await ctx.db.patch(currentUser._id, {
      blockedUsers: newBlockedUsers,
    });

    return newBlockedUsers;
  },
});