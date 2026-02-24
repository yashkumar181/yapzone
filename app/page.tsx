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
  const updatePresence = useMutation(api.users.updatePresence);
  
  const [activeChatId, setActiveChatId] = useState<Id<"conversations"> | null>(null);
  const [activeChatName, setActiveChatName] = useState<string | null>(null);
  const [activeChatIsGroup, setActiveChatIsGroup] = useState<boolean>(false);

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

  useEffect(() => {
    if (!user) return;
    updatePresence();
    const intervalId = setInterval(() => {
      updatePresence();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [user, updatePresence]);

  const handleSelectChat = (conversationId: Id<"conversations">, name: string, isGroup: boolean = false) => {
    setActiveChatId(conversationId);
    setActiveChatName(name);
    setActiveChatIsGroup(isGroup);
  };

  const handleCloseChat = () => {
    setActiveChatId(null);
    setActiveChatName(null);
    setActiveChatIsGroup(false);
  };

  if (!isLoaded) return null;

  return (
    // FIX: Changed h-screen to h-[100dvh] to prevent mobile browser UI shifting
    <main className="flex h-[100dvh] bg-white dark:bg-black overflow-hidden">
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
            isGroup={activeChatIsGroup} 
            onClose={handleCloseChat} 
            onSwitchChat={handleSelectChat}
          />
        )}
      </div>
    </main>
  );
}