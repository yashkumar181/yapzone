"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Search, Loader2, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton } from "@clerk/nextjs";

interface SidebarProps {
  onSelectChat: (conversationId: Id<"conversations">, otherUserName: string) => void;
}

export function Sidebar({ onSelectChat }: SidebarProps) {
  const users = useQuery(api.users.getUsers);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState<string | null>(null);

  const filteredUsers = users?.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartChat = async (otherUserId: string, otherUserName: string) => {
    setIsCreating(otherUserId);
    try {
      const conversationId = await getOrCreateConversation({ otherUserId });
      onSelectChat(conversationId, otherUserName);
    } catch (error) {
      console.error("Failed to create chat:", error);
    } finally {
      setIsCreating(null);
    }
  };

  return (
    <div className="w-80 h-screen border-r bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <div className="p-4 border-b flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chats</h2>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-8 bg-white dark:bg-zinc-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {users === undefined ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))
          ) : filteredUsers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
              <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-3 rounded-full">
                <SearchX className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No users found</p>
            </div>
          ) : (
            filteredUsers?.map((user) => (
              <button
                key={user._id}
                disabled={isCreating === user.clerkId}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
                onClick={() => handleStartChat(user.clerkId, user.name || "Unknown User")}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.imageUrl} />
                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm truncate">
                    {user.name}
                  </span>
                </div>
                {isCreating === user.clerkId && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}