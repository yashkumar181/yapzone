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
  
  // NEW: Chat Filter State (All | DMs | Groups)
  const [chatFilter, setChatFilter] = useState<"all" | "dms" | "groups">("all");

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const filteredUsers = users?.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // NEW: Filter Logic for Conversations
  const filteredConversations = conversations?.filter(conv => {
    if (chatFilter === "dms") return !conv.isGroup;
    if (chatFilter === "groups") return conv.isGroup;
    return true; // "all"
  });

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

  // NEW: Helper to get the real name of the sender for the preview
  const getSenderPrefix = (conv: any) => {
    if (!conv.lastMessage) return "";
    if (conv.lastMessage.senderId === user?.id) return "You: ";
    if (conv.isGroup) {
      const sender = users?.find(u => u.clerkId === conv.lastMessage.senderId);
      return sender ? `${sender.name?.split(' ')[0]}: ` : "Someone: ";
    }
    return "";
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
      <div className="pt-4 flex flex-col gap-4 border-b dark:border-white/[0.08]">
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
        <div className="relative px-4">
          <Search className="absolute left-7 top-2.5 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <Input
            placeholder="Search users..."
            className="pl-9 bg-zinc-200/50 dark:bg-white/[0.03] border-transparent dark:border-white/10 focus-visible:ring-1 focus-visible:ring-blue-500/50 transition-all rounded-xl shadow-inner placeholder:text-zinc-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* NEW: Chat Filter Pills */}
        <div className="flex items-center gap-2 px-4 pb-3 mt-[-4px]">
          <button onClick={() => setChatFilter("all")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${chatFilter === 'all' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-white/[0.04]'}`}>All</button>
          <button onClick={() => setChatFilter("dms")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${chatFilter === 'dms' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-white/[0.04]'}`}>Direct</button>
          <button onClick={() => setChatFilter("groups")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${chatFilter === 'groups' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-white/[0.04]'}`}>Groups</button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2 space-y-1">
          {searchQuery ? (
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
                    className="w-[calc(100%-16px)] mx-2 my-1 flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all text-left disabled:opacity-50 disabled:active:scale-100"
                    onClick={() => handleStartChat(user.clerkId, user.name || "Unknown User")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
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
            // Render filteredConversations instead of conversations
            filteredConversations === undefined ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 mx-2 my-1">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            ) : filteredConversations.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3 opacity-70">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No {chatFilter === "all" ? "chats" : chatFilter} found.</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv._id}
                  className="w-[calc(100%-16px)] mx-2 my-1 flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 shadow-sm hover:shadow-md hover:bg-zinc-50 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all text-left group relative"
                  onClick={() => handleSelectConversation(conv)}
                >
                  
                  <div className="relative shrink-0 flex items-center">
                    {/* NEW: Square Group Avatars */}
                    {conv.isGroup ? (
                       <Avatar className="h-10 w-10 rounded-xl border border-black/5 dark:border-white/10 shadow-sm transition-colors">
                         <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 text-blue-700 dark:text-blue-300 font-bold">
                           {conv.groupName?.substring(0, 2).toUpperCase()}
                         </AvatarFallback>
                       </Avatar>
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
                    
                    {/* NEW: Real Sender Names in Group Preview */}
                    <p className={`text-xs truncate transition-colors ${conv.unreadCount > 0 ? "text-blue-500 dark:text-blue-400 font-medium" : "text-zinc-500 dark:text-zinc-500"}`}>
                      {conv.lastMessage ? (
                         <>
                           <span className="font-semibold text-zinc-600 dark:text-zinc-400">{getSenderPrefix(conv)}</span>
                           <span>{conv.lastMessage.content}</span>
                         </>
                      ) : (
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