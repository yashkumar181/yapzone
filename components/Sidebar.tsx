"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Search, Loader2, SearchX, MessageSquare, Users, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton , useUser } from "@clerk/nextjs";
import { formatMessageTime } from "@/lib/utils";
import { Button } from "./ui/button";

interface SidebarProps {
  onSelectChat: (conversationId: Id<"conversations">, name: string, isGroup?: boolean) => void;
}

const isOnline = (lastSeen?: number) => {
  if (!lastSeen) return false;
  return Date.now() - lastSeen < 60000; 
};

export function Sidebar({ onSelectChat }: SidebarProps) {
  const { user } = useUser(); // <-- ADD THIS LINE
  const users = useQuery(api.users.getUsers);
  const conversations = useQuery(api.conversations.list);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const createGroup = useMutation(api.conversations.createGroup);
  const markAsRead = useMutation(api.conversations.markAsRead);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState<string | null>(null);

  // NEW: Group Modal States
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const filteredUsers = users?.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartChat = async (otherUserId: string, otherUserName: string) => {
    setIsCreating(otherUserId);
    try {
      const conversationId = await getOrCreateConversation({ otherUserId });
      onSelectChat(conversationId, otherUserName, false);
      await markAsRead({ conversationId });
      setSearchQuery(""); 
    } catch (error) {
      console.error("Failed to create chat:", error);
    } finally {
      setIsCreating(null);
    }
  };

  const handleSelectConversation = async (conv: any) => {
    const name = conv.isGroup ? conv.groupName : conv.otherUser?.name || "Unknown";
    onSelectChat(conv._id, name, conv.isGroup);
    try {
      await markAsRead({ conversationId: conv._id });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // NEW: Handle Group Creation
  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length < 1) return;
    setIsCreatingGroup(true);
    try {
      const conversationId = await createGroup({
        name: groupName.trim(),
        memberIds: selectedMembers,
      });
      onSelectChat(conversationId, groupName.trim(), true);
      setShowGroupModal(false);
      setGroupName("");
      setSelectedMembers([]);
    } catch (error) {
      console.error("Failed to create group:", error);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="w-full h-full border-r bg-zinc-50 dark:bg-zinc-950 flex flex-col relative">
      
      {/* NEW: Premium Group Creation Modal */}
      {showGroupModal && (
        <div className="absolute inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          <div className="p-4 border-b flex items-center justify-between bg-white dark:bg-zinc-950">
            <h2 className="font-bold text-lg">New Group</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowGroupModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4 border-b space-y-4 bg-white dark:bg-zinc-950">
            <Input
              placeholder="Group Subject"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-zinc-100 dark:bg-zinc-900 border-transparent font-medium text-lg"
              maxLength={25}
            />
            
            {/* Horizontal scrolling chips for selected members */}
            {selectedMembers.length > 0 && (
              <ScrollArea className="w-full whitespace-nowrap pb-2">
                <div className="flex gap-2">
                  {selectedMembers.map(id => {
                    const u = users?.find(user => user.clerkId === id);
                    if (!u) return null;
                    return (
                      <div key={id} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-full pl-1 pr-2 py-1 flex-shrink-0 animate-in zoom-in-50 duration-200">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.imageUrl} />
                          <AvatarFallback>{u.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{u.name?.split(' ')[0]}</span>
                        <button onClick={() => toggleMember(id)} className="ml-1 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          <ScrollArea className="flex-1 p-2">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-2 uppercase tracking-wider">Select Members</p>
            {users?.map((user) => (
              <button
                key={user._id}
                onClick={() => toggleMember(user.clerkId)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.imageUrl} />
                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{user.name}</span>
                </div>
                <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                  selectedMembers.includes(user.clerkId) ? "bg-black border-black text-white dark:bg-white dark:border-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"
                }`}>
                  {selectedMembers.includes(user.clerkId) && <Check className="h-3 w-3" />}
                </div>
              </button>
            ))}
          </ScrollArea>

          <div className="p-4 border-t bg-white dark:bg-zinc-950">
            <Button 
              className="w-full rounded-full font-bold" 
              size="lg"
              disabled={!groupName.trim() || selectedMembers.length < 1 || isCreatingGroup}
              onClick={handleCreateGroup}
            >
              {isCreatingGroup ? <Loader2 className="h-5 w-5 animate-spin" /> : `Create Group (${selectedMembers.length})`}
            </Button>
          </div>
        </div>
      )}

      {/* Standard Sidebar Content */}
      <div className="p-4 border-b flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Chats</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowGroupModal(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Users className="h-5 w-5" />
            </Button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
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
            // Search Results (Kept identical)
            filteredUsers === undefined ? (
               <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                <SearchX className="h-6 w-6 text-muted-foreground" />
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
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={user.imageUrl} />
                          <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {isOnline(user.lastSeen) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full z-10"></span>
                        )}
                      </div>
                      <span className="font-medium text-sm truncate">{user.name}</span>
                    </div>
                    {isCreating === user.clerkId && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </button>
                ))}
              </>
            )
          ) : (
            // Conversations List (Upgraded with Stacked Avatars for Groups)
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
                <p className="text-sm text-muted-foreground">No chats yet. <br/> Search above to start one!</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv._id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-left group relative"
                  onClick={() => handleSelectConversation(conv)}
                >
                  
                  {/* Avatar Rendering: Stacked for Groups, Single for 1-on-1 */}
                  <div className="relative shrink-0 flex items-center">
                    {conv.isGroup ? (
                       <div className="flex -space-x-3 rtl:space-x-reverse relative z-0">
                         {/* Show up to 3 avatars stacked */}
                         {(conv.groupMembers || []).slice(0, 3).map((member: any, i: number) => (
                           <Avatar key={i} className="border-2 border-zinc-50 dark:border-zinc-950 h-10 w-10">
                             <AvatarImage src={member?.imageUrl} />
                             <AvatarFallback>{member?.name?.charAt(0)}</AvatarFallback>
                           </Avatar>
                         ))}
                         {/* If more than 3 members, show a + count */}
                         {(conv.groupMembers?.length || 0) > 3 && (
                           <div className="flex items-center justify-center h-10 w-10 rounded-full border-2 border-zinc-50 dark:border-zinc-950 bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold z-10">
                             +{(conv.groupMembers?.length || 0) - 3}
                           </div>
                         )}
                       </div>
                    ) : (
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={conv.otherUser?.imageUrl} />
                          <AvatarFallback>{conv.otherUser?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {isOnline(conv.otherUser?.lastSeen) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-800 group-hover:dark:border-zinc-800 rounded-full z-10"></span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={`font-medium text-sm truncate ${conv.unreadCount > 0 ? "text-foreground font-bold" : ""}`}>
                        {conv.isGroup ? conv.groupName : conv.otherUser?.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {conv.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[1.25rem]">
                            {conv.unreadCount}
                          </span>
                        )}
                        {conv.lastMessage && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-1">
                            {formatMessageTime(conv.lastMessage._creationTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className={`text-xs truncate transition-colors ${conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-zinc-900 dark:group-hover:text-zinc-100"}`}>
                      {conv.lastMessage ? (
                         (conv.isGroup && conv.lastMessage.senderId !== user?.id ? "Someone: " : (conv.lastMessage.senderId !== conv.otherUser?.clerkId && !conv.isGroup ? "You: " : "")) + 
                         conv.lastMessage.content
                      ) : (
                        <span className="italic">{conv.isGroup ? "Group created" : "Started a conversation"}</span>
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