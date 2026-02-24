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
import { ThemeToggle } from "./ThemeToggle";

interface SidebarProps {
  onSelectChat: (conversationId: Id<"conversations">, name: string, isGroup?: boolean) => void;
}

const isOnline = (lastSeen?: number) => {
  if (!lastSeen) return false;
  return Date.now() - lastSeen < 60000; 
};

export function Sidebar({ onSelectChat }: SidebarProps) {
  const { user } = useUser();
  const users = useQuery(api.users.getUsers);
  const conversations = useQuery(api.conversations.list);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const createGroup = useMutation(api.conversations.createGroup);
  const markAsRead = useMutation(api.conversations.markAsRead);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState<string | null>(null);

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
      
      {/* Premium Group Creation Modal */}
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

      {/* Upgraded Header & Search Bar */}
      <div className="pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-xl font-semibold tracking-tight">Chats</h2>
          <div className="flex items-center gap-2">
            
            <ThemeToggle />
            
            <Button variant="ghost" size="icon" onClick={() => setShowGroupModal(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Users className="h-5 w-5" />
            </Button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
        
        {/* Premium "Frosted" Search Input */}
        <div className="relative px-4 pb-4 border-b dark:border-white/[0.08]">
          <Search className="absolute left-7 top-2.5 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <Input
            placeholder="Search users..."
            className="pl-9 bg-zinc-200/50 dark:bg-white/[0.03] border-transparent dark:border-white/10 focus-visible:ring-1 focus-visible:ring-blue-500/50 transition-all rounded-xl shadow-inner placeholder:text-zinc-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2 space-y-1">
          {searchQuery ? (
            // Search Results 
            filteredUsers === undefined ? (
               <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                <SearchX className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No users found</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground px-4 py-2">Found Users</p>
                {filteredUsers.map((user) => (
                  <button
                    key={user._id}
                    disabled={isCreating === user.clerkId}
                    // Upgraded Hover & Scale Effects for Search list
                    className="w-[calc(100%-16px)] mx-2 my-1 flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all text-left disabled:opacity-50 disabled:active:scale-100"
                    onClick={() => handleStartChat(user.clerkId, user.name || "Unknown User")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {/* Avatar with subtle translucent border for depth */}
                        <Avatar className="border border-black/5 dark:border-white/10 shadow-sm">
                          <AvatarImage src={user.imageUrl} />
                          <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {isOnline(user.lastSeen) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full z-10"></span>
                        )}
                      </div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">{user.name}</span>
                    </div>
                    {isCreating === user.clerkId && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </button>
                ))}
              </>
            )
          ) : (
            // Conversations List 
            conversations === undefined ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 mx-2 my-1">
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
                  // Floating 'Pill' Style with Press Animation
                  className="w-[calc(100%-16px)] mx-2 my-1 flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all text-left group relative"
                  onClick={() => handleSelectConversation(conv)}
                >
                  
                  {/* Avatar Rendering - Added translucent borders for depth */}
                  <div className="relative shrink-0 flex items-center">
                    {conv.isGroup ? (
                       <div className="flex -space-x-3 rtl:space-x-reverse relative z-0">
                         {(conv.groupMembers || []).slice(0, 3).map((member: any, i: number) => (
                           <Avatar key={i} className="border-2 border-zinc-50 dark:border-zinc-950 h-10 w-10 transition-colors shadow-sm">
                             <AvatarImage src={member?.imageUrl} />
                             <AvatarFallback className="border dark:border-white/10">{member?.name?.charAt(0)}</AvatarFallback>
                           </Avatar>
                         ))}
                         {(conv.groupMembers?.length || 0) > 3 && (
                           <div className="flex items-center justify-center h-10 w-10 rounded-full border-2 border-zinc-50 dark:border-zinc-950 bg-zinc-200 dark:bg-zinc-800 dark:border-white/10 text-[10px] font-bold z-10 shadow-sm">
                             +{(conv.groupMembers?.length || 0) - 3}
                           </div>
                         )}
                       </div>
                    ) : (
                      <div className="relative">
                        <Avatar className="border border-black/5 dark:border-white/10 shadow-sm">
                          <AvatarImage src={conv.otherUser?.imageUrl} />
                          <AvatarFallback>{conv.otherUser?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {isOnline(conv.otherUser?.lastSeen) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-50 dark:border-zinc-950 rounded-full z-10"></span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={`truncate text-sm ${conv.unreadCount > 0 ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-semibold text-zinc-700 dark:text-zinc-300"}`}>
                        {conv.isGroup ? conv.groupName : conv.otherUser?.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {conv.unreadCount > 0 && (
                          /* Glowing Unread Badge */
                          <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[1.25rem] shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                            {conv.unreadCount}
                          </span>
                        )}
                        {conv.lastMessage && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap ml-1 font-medium">
                            {formatMessageTime(conv.lastMessage._creationTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className={`text-xs truncate transition-colors ${conv.unreadCount > 0 ? "text-blue-500 dark:text-blue-400 font-medium" : "text-zinc-500 dark:text-zinc-500"}`}>
                      {conv.lastMessage ? (
                         (conv.isGroup && conv.lastMessage.senderId !== user?.id ? "Someone: " : (conv.lastMessage.senderId !== conv.otherUser?.clerkId && !conv.isGroup ? "You: " : "")) + 
                         conv.lastMessage.content
                      ) : (
                        /* Removed italics, used standard font with lighter gray */
                        <span className="font-medium">{conv.isGroup ? "Group created" : "Started a conversation"}</span>
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