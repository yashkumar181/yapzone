"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { MessageSquare } from "lucide-react";

export default function Home() {
  const { user, isLoaded } = useUser();
  const syncUser = useMutation(api.users.syncUser);
  const updatePresence = useMutation(api.users.updatePresence); // NEW: Get the mutation
  
  const [activeChatId, setActiveChatId] = useState<Id<"conversations"> | null>(null);
  const [activeChatName, setActiveChatName] = useState<string | null>(null);

  // Sync user profile when they log in
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

  // NEW: The "Heartbeat" effect to track online status
  useEffect(() => {
    if (!user) return;

    // Fire immediately when the page loads
    updatePresence();

    // Then ping the database every 30 seconds
    const intervalId = setInterval(() => {
      updatePresence();
    }, 30000);

    // Cleanup the interval if the user navigates away or closes the component
    return () => clearInterval(intervalId);
  }, [user, updatePresence]);

  const handleSelectChat = (conversationId: Id<"conversations">, otherUserName: string) => {
    setActiveChatId(conversationId);
    setActiveChatName(otherUserName);
  };

  const handleCloseChat = () => {
    setActiveChatId(null);
    setActiveChatName(null);
  };

  if (!isLoaded) return null;

  return (
    <main className="flex h-screen bg-white dark:bg-black overflow-hidden">
      <div className={`${activeChatId ? "hidden md:block" : "block"} w-full md:w-80 h-full shrink-0`}>
        <Sidebar onSelectChat={handleSelectChat} />
      </div>

      <div className={`${!activeChatId ? "hidden md:flex" : "flex"} flex-1 flex-col bg-zinc-100 dark:bg-zinc-900`}>
        {!activeChatId ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/50">
            <div className="bg-white dark:bg-zinc-950 h-24 w-24 rounded-full flex items-center justify-center shadow-sm mb-6 border">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Welcome to YapZone</h2>
            <p className="text-muted-foreground max-w-sm text-center text-sm">
              Select a conversation from the sidebar to start chatting, or search for someone new.
            </p>
          </div>
        ) : (
          <ChatArea 
            conversationId={activeChatId} 
            otherUserName={activeChatName || "Unknown"} 
            onClose={handleCloseChat} 
          />
        )}
      </div>
    </main>
  );
}