"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
// NEW: Imported Pin icon
import { Search, Loader2, SearchX, MessageSquare, Users, X, Check, Trash2, PlusCircle, Ban, Pin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton , useUser } from "@clerk/nextjs";
import { formatMessageTime } from "@/lib/utils";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { toast } from "sonner";

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
  
  const currentUser = useQuery(api.users.getCurrentUser);
  
  const conversations = useQuery(api.conversations.list);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const createGroup = useMutation(api.conversations.createGroup);
  const markAsRead = useMutation(api.conversations.markAsRead);
  const deleteChatMutation = useMutation(api.conversations.deleteConversation);
  
  const toggleBlockUser = useMutation(api.users.toggleBlockUser);
  const togglePin = useMutation(api.conversations.togglePin); // NEW: Toggle Pin
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<"all" | "dms" | "groups">("all");

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [showAllUsersModal, setShowAllUsersModal] = useState(false);
  const [userToStartChat, setUserToStartChat] = useState<{id: string, name: string} | null>(null);

  const [contextMenu, setContextMenu] = useState<{ 
    id: Id<"conversations">, 
    x: number, 
    y: number,
    otherUserClerkId?: string,
    isGroup?: boolean,
    isPinned?: boolean // NEW
  } | null>(null);
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const filteredUsers = users?.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations?.filter(conv => {
    if (chatFilter === "dms") return !conv.isGroup;
    if (chatFilter === "groups") return conv.isGroup;
    return true; 
  });

  // NEW: Sort filtered conversations to push pinned ones to the top
  const sortedConversations = filteredConversations ? [...filteredConversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0; // Fallback to Convex's time-based sort
  }) : undefined;

  const handleStartChat = async (otherUserId: string, otherUserName: string) => {
    setIsCreating(otherUserId);
    try {
      const conversationId = await getOrCreateConversation({ otherUserId });
      onSelectChat(conversationId, otherUserName, false);
      await markAsRead({ conversationId });
      setSearchQuery(""); 
      setShowAllUsersModal(false);
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

  const handleDeleteChat = async (conversationId: Id<"conversations">) => {
    try {
      await deleteChatMutation({ conversationId });
      toast.success("Chat deleted");
      setContextMenu(null);
    } catch (error) {
      toast.error("Failed to delete chat");
    }
  };

  const handleToggleBlock = async (clerkIdToToggle: string, currentlyBlocked: boolean) => {
    try {
      await toggleBlockUser({ clerkIdToToggle });
      toast.success(currentlyBlocked ? "User unblocked" : "User blocked");
      setContextMenu(null);
    } catch (error) {
      toast.error("Failed to update block status");
    }
  };

  const handleTogglePin = async (conversationId: Id<"conversations">, isCurrentlyPinned: boolean) => {
    try {
      await togglePin({ conversationId });
      toast.success(isCurrentlyPinned ? "Conversation unpinned" : "Conversation pinned");
      setContextMenu(null);
    } catch (error) {
      toast.error("Failed to pin conversation");
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

  const getSenderPrefix = (conv: any) => {
    if (!conv.lastMessage) return "";
    if (conv.lastMessage.senderId === user?.id) return "You: ";
    if (conv.isGroup) {
      const sender = users?.find(u => u.clerkId === conv.lastMessage.senderId);
      return sender ? `${sender.name?.split(' ')[0]}: ` : "Someone: ";
    }
    return "";
  };

  const handleTouchStart = (e: React.TouchEvent, conv: any) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ 
        id: conv._id, 
        x: touch.clientX, 
        y: touch.clientY,
        otherUserClerkId: conv.otherUser?.clerkId,
        isGroup: conv.isGroup,
        isPinned: conv.isPinned
      });
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500); 
  };

  const handleTouchEndOrMove = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  return (
    <div className="w-full h-full border-r bg-zinc-50 dark:bg-zinc-950 flex flex-col relative" onContextMenu={(e) => e.preventDefault()}>
      
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-white dark:bg-zinc-900 border dark:border-zinc-800 shadow-xl rounded-xl py-1 w-48 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* NEW: Pin / Unpin Button */}
          <button 
            className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
            onClick={() => handleTogglePin(contextMenu.id, !!contextMenu.isPinned)}
          >
            <Pin className={`h-4 w-4 ${contextMenu.isPinned ? "fill-current" : ""}`} />
            {contextMenu.isPinned ? "Unpin Chat" : "Pin Chat"}
          </button>

          {!contextMenu.isGroup && contextMenu.otherUserClerkId && (
            <button 
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
              onClick={() => {
                const isBlocked = currentUser?.blockedUsers?.includes(contextMenu.otherUserClerkId!);
                handleToggleBlock(contextMenu.otherUserClerkId!, !!isBlocked);
              }}
            >
              <Ban className="h-4 w-4" />
              {currentUser?.blockedUsers?.includes(contextMenu.otherUserClerkId) ? "Unblock User" : "Block User"}
            </button>
          )}

          <button 
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors"
            onClick={() => handleDeleteChat(contextMenu.id)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Chat
          </button>
        </div>
      )}

      {userToStartChat && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); setUserToStartChat(null); }}>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-xl max-w-sm w-full flex flex-col gap-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-bold text-lg">Start Chat?</h3>
              <p className="text-sm text-muted-foreground mt-1">Do you want to text {userToStartChat.name}?</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setUserToStartChat(null)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                disabled={isCreating === userToStartChat.id}
                onClick={() => {
                  handleStartChat(userToStartChat.id, userToStartChat.name);
                  setUserToStartChat(null);
                }}
              >
                {isCreating === userToStartChat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Chat"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAllUsersModal && (
        <div className="absolute inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          <div className="shrink-0 p-4 border-b flex items-center justify-between bg-white dark:bg-zinc-950">
            <h2 className="font-bold text-lg">People on YapZone</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowAllUsersModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 min-h-0 p-2">
            {users?.filter(u => u.clerkId !== user?.id).map((u) => (
              <button
                key={u._id}
                onClick={() => setUserToStartChat({ id: u.clerkId, name: u.name || "User" })}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left"
              >
                <div className="relative">
                  <Avatar className="border shadow-sm">
                    <AvatarImage src={u.imageUrl} />
                    <AvatarFallback>{u.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {isOnline(u.lastSeen) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full z-10"></span>
                  )}
                </div>
                <span className="font-semibold text-sm">{u.name}</span>
              </button>
            ))}
            {users?.filter(u => u.clerkId !== user?.id).length === 0 && (
               <div className="p-6 text-center text-sm text-muted-foreground">No other users found.</div>
            )}
          </ScrollArea>
        </div>
      )}

      {showGroupModal && (
        <div className="absolute inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          <div className="shrink-0 p-4 border-b flex items-center justify-between bg-white dark:bg-zinc-950">
            <h2 className="font-bold text-lg">New Group</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowGroupModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="shrink-0 p-4 border-b space-y-4 bg-white dark:bg-zinc-950">
            <Input
              placeholder="Group Subject"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-zinc-100 dark:bg-zinc-900 border-transparent font-medium text-lg"
              maxLength={25}
            />
            
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

          <ScrollArea className="flex-1 min-h-0 p-2">
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

          <div className="shrink-0 p-4 border-t bg-white dark:bg-zinc-950">
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

      <div className="shrink-0 pt-4 flex flex-col gap-4 border-b dark:border-white/[0.08]">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-xl font-semibold tracking-tight">Chats</h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setShowAllUsersModal(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Users className="h-5 w-5" />
            </Button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
        
        <div className="relative px-4">
          <Search className="absolute left-7 top-2.5 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <Input
            placeholder="Search users..."
            className="pl-9 bg-zinc-200/50 dark:bg-white/[0.03] border-transparent dark:border-white/10 focus-visible:ring-1 focus-visible:ring-blue-500/50 transition-all rounded-xl shadow-inner placeholder:text-zinc-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between px-4 pb-3 mt-[-4px]">
          <div className="flex items-center gap-2">
            <button onClick={() => setChatFilter("all")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${chatFilter === 'all' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-white/[0.04]'}`}>All</button>
            <button onClick={() => setChatFilter("dms")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${chatFilter === 'dms' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-white/[0.04]'}`}>Direct</button>
            <button onClick={() => setChatFilter("groups")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${chatFilter === 'groups' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-white/[0.04]'}`}>Groups</button>
          </div>
          
          <button 
            onClick={() => setShowGroupModal(true)} 
            className="text-xs flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Group
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
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
            sortedConversations === undefined ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 mx-2 my-1">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            ) : sortedConversations.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3 opacity-70">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No {chatFilter === "all" ? "chats" : chatFilter} found.</p>
              </div>
            ) : (
              // UPDATED: Now mapping over the sorted list!
              sortedConversations.map((conv) => (
                <div 
                  key={conv._id}
                  className="relative"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ 
                      id: conv._id, 
                      x: e.clientX, 
                      y: e.clientY,
                      otherUserClerkId: conv.otherUser?.clerkId,
                      isGroup: conv.isGroup,
                      isPinned: conv.isPinned
                    });
                  }}
                >
                  <button
                    className="w-[calc(100%-16px)] mx-2 my-1 flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 shadow-sm hover:shadow-md hover:bg-zinc-50 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all text-left group relative"
                    onClick={() => handleSelectConversation(conv)}
                    onTouchStart={(e) => handleTouchStart(e, conv)}
                    onTouchMove={handleTouchEndOrMove}
                    onTouchEnd={handleTouchEndOrMove}
                  >
                    
                    <div className="relative shrink-0 flex items-center">
                      {conv.isGroup ? (
                         <Avatar className="h-10 w-10 rounded-xl border border-black/5 dark:border-white/10 shadow-sm transition-colors">
                           <AvatarImage src={conv.groupImageUrl} className="object-cover" />
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
                          {/* NEW: Show Pin Icon */}
                          {conv.isPinned && (
                            <Pin className="h-3 w-3 text-muted-foreground fill-current" />
                          )}
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
                </div>
              ))
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}