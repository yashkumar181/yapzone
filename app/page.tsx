"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect } from "react";

export default function Home() {
  const { user, isLoaded } = useUser();
  const syncUser = useMutation(api.users.syncUser);

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

  if (!isLoaded) return null; // Or a loading spinner

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Welcome to YapZone
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:size-auto lg:bg-none">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="font-semibold text-lg">{user.fullName}</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <a href="/sign-in" className="font-semibold hover:underline">
              Sign In
            </a>
          )}
        </div>
      </div>
    </main>
  );
}