"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  const { user } = useUser();
  const syncUser = useMutation(api.users.syncUser);

  // Still keeping our sync logic to ensure the user profile is in the DB!
  useEffect(() => {
    if (user) {
      syncUser({
        clerkId: user.id,
        email: user.emailAddresses[0].emailAddress,
        name: user.fullName || user.firstName || "Unknown",
        imageUrl: user.imageUrl,
      });
    }
  }, [user, syncUser]);

  return (
    <main className="flex h-screen bg-white dark:bg-black overflow-hidden">
      {/* Left Side: Our new Sidebar */}
      <Sidebar />

      {/* Right Side: The Chat Area (Placeholder for now) */}
      <div className="flex-1 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <p className="text-muted-foreground">
          Select a conversation to start chatting
        </p>
      </div>
    </main>
  );
}