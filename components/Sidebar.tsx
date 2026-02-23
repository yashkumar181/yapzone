"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Search, Loader2, SearchX, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton } from "@clerk/nextjs";
import { formatMessageTime } from "@/lib/utils";

interface SidebarProps {
  onSelectChat: (conversationId: Id<"conversations">, otherUserName: string) => void;
}

// NEW: Helper function to determine if a user is online
// We consider them online if their last heartbeat was less than 1 minute ago (60000 ms)
const isOnline = (lastSeen?: number) => {
  if (!lastSeen) return false;
  return Date.now() - lastSeen < 60000; 
};

export function Sidebar({ onSelectChat }: SidebarProps) {
  const users = useQuery(api.users.getUsers);
  const conversations = useQuery(api.conversations.list);
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
      setSearchQuery(""); 
    } catch (error) {
      console.error("Failed to create chat:", error);
    } finally {
      setIsCreating(null);
    }
  };

  return (
    <div className="w-full h-full border-r bg-zinc-50 dark:bg-zinc-950 flex flex-col">
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
          {searchQuery ? (
            filteredUsers === undefined ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-3 rounded-full">
                  <SearchX className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No users found</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground px-2 py-2">Found Users</p>
                {filteredUsers.map((user) => (
                  <button
                    key={user._id}
                    disabled={isCreating === user.clerkId}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
                    onClick={() => handleStartChat(user.clerkId, user.name || "Unknown User")}
                  >
                    <div className="flex items-center gap-3">
                      {/* UPDATED: Avatar with Online Indicator */}
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={user.imageUrl} />
                          <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {isOnline(user.lastSeen) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full z-10"></span>
                        )}
                      </div>
                      <span className="font-medium text-sm truncate">
                        {user.name}
                      </span>
                    </div>
                    {isCreating === user.clerkId && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </>
            )
          ) : (
            conversations === undefined ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3 opacity-70">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No chats yet. <br/> Search above to start one!
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv._id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-left group"
                  onClick={() => onSelectChat(conv._id, conv.otherUser?.name || "Unknown")}
                >
                  {/* UPDATED: Avatar with Online Indicator */}
                  <div className="relative shrink-0">
                    <Avatar>
                      <AvatarImage src={conv.otherUser?.imageUrl} />
                      <AvatarFallback>{conv.otherUser?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {isOnline(conv.otherUser?.lastSeen) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-800 group-hover:dark:border-zinc-800 rounded-full z-10"></span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-medium text-sm truncate">
                        {conv.otherUser?.name}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {formatMessageTime(conv.lastMessage._creationTime)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                      {conv.lastMessage ? (
                         (conv.lastMessage.senderId !== conv.otherUser?.clerkId ? "You: " : "") + 
                         conv.lastMessage.content
                      ) : (
                        <span className="italic">Started a conversation</span>
                      )}
                    </p>
                  </div>
                </button>
              ))
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}