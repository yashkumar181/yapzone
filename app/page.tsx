"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";

export default function Home() {
  const { user, isLoaded } = useUser();
  const syncUser = useMutation(api.users.syncUser);
  
  const [activeChatId, setActiveChatId] = useState<Id<"conversations"> | null>(null);
  const [activeChatName, setActiveChatName] = useState<string | null>(null);

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

  const handleSelectChat = (conversationId: Id<"conversations">, otherUserName: string) => {
    setActiveChatId(conversationId);
    setActiveChatName(otherUserName);
  };

  // Prevent flicker while Clerk loads auth state
  if (!isLoaded) return null;

  return (
    <main className="flex h-screen bg-white dark:bg-black overflow-hidden">
      <Sidebar onSelectChat={handleSelectChat} />

      {/* The Chat Area */}
      <div className="flex-1 flex flex-col bg-zinc-100 dark:bg-zinc-900">
        {!activeChatId ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground font-medium bg-white dark:bg-zinc-950 px-6 py-3 rounded-full shadow-sm">
              Select a conversation to start chatting
            </p>
          </div>
        ) : (
          <ChatArea 
            conversationId={activeChatId} 
            otherUserName={activeChatName || "Unknown"} 
          />
        )}
      </div>
    </main>
  );
}