"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send, MessageCircle, ArrowLeft, ArrowDown, Trash2, Ban, Smile, X, LogOut, Crown, Users, Pencil, Check, CheckCheck, UserMinus, Reply, UserPlus, Pin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMessageTime } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatAreaProps {
  conversationId: Id<"conversations">;
  otherUserName: string;
  isGroup?: boolean;
  onClose: () => void;
  onSwitchChat?: (conversationId: Id<"conversations">, name: string, isGroup?: boolean) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export function ChatArea({ conversationId, otherUserName, isGroup, onClose, onSwitchChat }: ChatAreaProps) {
  const { user } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedChatRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);

  const currentUser = useQuery(api.users.getCurrentUser);
  const toggleBlockUser = useMutation(api.users.toggleBlockUser);
  const togglePin = useMutation(api.conversations.togglePin);

  const messages = useQuery(api.messages.list, { conversationId });
  const users = useQuery(api.users.getUsers);
  const conversation = useQuery(api.conversations.getConversation, { conversationId });

  const [isSearching, setIsSearching] = useState(false);
  const [searchQueryInput, setSearchQueryInput] = useState("");
  const [highlightedMessageId, setHighlightedMessageId] = useState<Id<"messages"> | null>(null);
  const searchResults = useQuery(api.messages.searchMessages,
    isSearching && searchQueryInput.trim() ? { conversationId, query: searchQueryInput } : "skip"
  );

  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.remove);
  const editMessageMutation = useMutation(api.messages.edit);
  const toggleReaction = useMutation(api.messages.react);
  const startTyping = useMutation(api.typing.start);
  const stopTyping = useMutation(api.typing.stop);
  const markAsRead = useMutation(api.conversations.markAsRead);
  const typingIndicators = useQuery(api.typing.getActive, { conversationId });

  const [newMessage, setNewMessage] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const lastTypingTimeRef = useRef<number>(0);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Id<"messages"> | null>(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<Id<"messages"> | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<Id<"messages"> | null>(null);
  const [editMessageContent, setEditMessageContent] = useState("");

  const [mobileActiveMessage, setMobileActiveMessage] = useState<Id<"messages"> | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);

  const leaveGroupMutation = useMutation(api.conversations.leaveGroup);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const kickMemberMutation = useMutation(api.conversations.kickMember);
  const updateGroupDetailsMutation = useMutation(api.conversations.updateGroupDetails);
  const addMembersMutation = useMutation(api.conversations.addMembers);
  const renameGroupMutation = useMutation(api.conversations.renameGroup);

  const [memberToChat, setMemberToChat] = useState<{ id: string, name: string } | null>(null);
  const [memberToKick, setMemberToKick] = useState<{ id: string, name: string } | null>(null);

  const isPastMember = conversation?.pastMembers?.includes(user?.id || "");
  const isAdmin = conversation?.groupAdmin === user?.id;
  const isPinned = conversation?.pinnedBy?.includes(user?.id || "");

  const otherUserId = !isGroup && conversation ? (conversation.participantOne === user?.id ? conversation.participantTwo : conversation.participantOne) : null;
  const otherUserObj = users?.find(u => u.clerkId === otherUserId);

  const isChatReady = currentUser !== undefined && users !== undefined && conversation !== undefined;
  const isBlockedByMe = isChatReady && otherUserId ? (currentUser?.blockedUsers || []).includes(otherUserId) : false;
  const hasBlockedMe = isChatReady && otherUserObj ? (otherUserObj.blockedUsers || []).includes(user?.id || "") : false;

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editDescValue, setEditDescValue] = useState("");
  const [editImgValue, setEditImgValue] = useState("");

  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");

  const [replyingTo, setReplyingTo] = useState<{ id: Id<"messages">; content: string; senderName: string } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<{ [key: string]: number }>({});
  const swipeStartRef = useRef<{ id: string; x: number } | null>(null);

  useEffect(() => {
    setIsSearching(false);
    setSearchQueryInput("");
    setHighlightedMessageId(null);
  }, [conversationId]);

  const scrollToMessage = (msgId: Id<"messages">) => {
    setIsSearching(false);
    setSearchQueryInput("");
    const el = document.getElementById(`msg-container-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(msgId);
      setTimeout(() => setHighlightedMessageId(null), 2500);
    } else {
      toast.error("Message not loaded yet.");
    }
  };

  const handleGlobalTap = () => {
    if (mobileActiveMessage) setMobileActiveMessage(null);
    if (selectedMessageForReaction) setSelectedMessageForReaction(null);
    if (isSearching) setIsSearching(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setIsAtBottom(atBottom);
    if (atBottom) setShowScrollButton(false);
    handleGlobalTap();
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setShowScrollButton(false);
  };

  useEffect(() => {
    if (messages) {
      markAsRead({ conversationId }).catch(() => { });
      const isNewMessageAdded = messages.length > prevMessageCountRef.current;
      prevMessageCountRef.current = messages.length;

      if (loadedChatRef.current !== conversationId) {
        scrollRef.current?.scrollIntoView({ behavior: "auto" });
        loadedChatRef.current = conversationId;
      } else if (isNewMessageAdded) {
        if (isAtBottom) {
          scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        } else {
          setShowScrollButton(true);
        }
      }
    }
  }, [messages, conversationId, markAsRead]);

  useEffect(() => {
    if (isAtBottom && typingIndicators && typingIndicators.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [typingIndicators]);

  useEffect(() => {
    return () => {
      stopTyping({ conversationId }).catch(() => { });
    };
  }, [conversationId, stopTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (value.trim() === "") {
      stopTyping({ conversationId });
      setMentionQuery(null);
      return;
    }

    const now = Date.now();
    if (now - lastTypingTimeRef.current > 1000) {
      startTyping({ conversationId });
      lastTypingTimeRef.current = now;
    }

    if (isGroup && !isPastMember) {
      const cursorPosition = e.target.selectionStart || 0;
      const textBeforeCursor = value.slice(0, cursorPosition);
      const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

      if (match) {
        setMentionQuery(match[1].toLowerCase());
      } else {
        setMentionQuery(null);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!navigator.onLine) return toast.error("You are offline.");

    const content = newMessage.trim();
    setNewMessage("");
    stopTyping({ conversationId });

    setIsAtBottom(true);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      await sendMessage({ conversationId, content, replyTo: replyingTo?.id });
      setReplyingTo(null);
    } catch (error: any) {
      toast.error(error.data || "Failed to send message.");
      setNewMessage(content);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editMessageContent.trim()) {
      setEditingMessageId(null);
      return;
    }

    try {
      await editMessageMutation({
        messageId: editingMessageId,
        newContent: editMessageContent
      });
      setEditingMessageId(null);
    } catch (error) {
      toast.error("Failed to edit message");
    }
  };

  const executeDelete = async (type: "for_me" | "for_everyone") => {
    if (!messageToDelete) return;
    try {
      await deleteMessage({ messageId: messageToDelete, type });
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Could not delete message.");
    } finally {
      setMessageToDelete(null);
      setMobileActiveMessage(null);
    }
  };

  const handleToggleReaction = async (msgId: Id<"messages">, emoji: string) => {
    try {
      await toggleReaction({ messageId: msgId, emoji });
    } catch (error) {
      toast.error("Could not add reaction.");
    }
  };

  const handleTouchStart = (e: React.TouchEvent, msgId: Id<"messages">) => {
    if (mobileActiveMessage !== msgId) {
      setMobileActiveMessage(null);
      setSelectedMessageForReaction(null);
    }
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => setMobileActiveMessage(msgId), 400);
    swipeStartRef.current = { id: msgId, x: e.touches[0].clientX };
  };

  const handleTouchMove = (e: React.TouchEvent, msgId: Id<"messages">) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!swipeStartRef.current || swipeStartRef.current.id !== msgId) return;
    const diff = e.touches[0].clientX - swipeStartRef.current.x;
    if (diff > 0 && diff < 70) {
      setSwipeOffset(prev => ({ ...prev, [msgId]: diff }));
    }
  };

  const handleTouchEnd = (msgId: Id<"messages">, content: string, senderName: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const diff = swipeOffset[msgId] || 0;
    if (diff > 45) {
      setReplyingTo({ id: msgId, content, senderName });
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }
    setSwipeOffset(prev => ({ ...prev, [msgId]: 0 }));
    swipeStartRef.current = null;
  };

  const confirmLeaveGroup = async (deleteHistory: boolean) => {
    try {
      await leaveGroupMutation({ conversationId, deleteHistory });
      toast.success(deleteHistory ? "Group deleted" : "Left the group");
      setShowLeaveModal(false);
      onClose();
    } catch (error) {
      toast.error("Failed to process request");
    }
  };

  const handleStartPrivateChat = async () => {
    if (!memberToChat || !onSwitchChat) return;
    try {
      const newConvId = await getOrCreateConversation({ otherUserId: memberToChat.id });
      setShowGroupInfo(false);
      setMemberToChat(null);
      onSwitchChat(newConvId, memberToChat.name, false);
    } catch (error) {
      toast.error("Could not start chat");
    }
  };

  const handleMentionSelect = (name: string) => {
    if (mentionQuery === null) return;
    const formattedName = name.replace(/\s+/g, "");
    const lastAtIndex = newMessage.lastIndexOf("@" + mentionQuery);
    if (lastAtIndex !== -1) {
      const newValue = newMessage.substring(0, lastAtIndex) + "@" + formattedName + " " + newMessage.substring(lastAtIndex + 1 + mentionQuery.length);
      setNewMessage(newValue);
    }
    setMentionQuery(null);
  };

  const renderMessageContent = (text: string) => {
    if (!isGroup) return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            return <span key={i} className="text-blue-500 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/50 px-1 rounded-md">{part}</span>;
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  };

  const handleSaveGroupDetails = async () => {
    if (!editNameValue.trim()) return setIsEditingGroup(false);
    try {
      await updateGroupDetailsMutation({
        conversationId,
        description: editDescValue.trim() || undefined,
        imageUrl: editImgValue.trim() || undefined,
      });
      if (editNameValue.trim() !== conversation?.groupName) {
        await renameGroupMutation({ conversationId, newName: editNameValue });
      }
      setIsEditingGroup(false);
      toast.success("Group details updated!");
    } catch (error) {
      toast.error("Failed to update group");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const base64String = canvas.toDataURL("image/jpeg", 0.8);
        setEditImgValue(base64String);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleKickMemberClick = (e: React.MouseEvent, memberId: string, memberName: string) => {
    e.stopPropagation();
    setMemberToKick({ id: memberId, name: memberName });
  };

  const confirmKickMember = async () => {
    if (!memberToKick) return;
    try {
      await kickMemberMutation({ conversationId, memberIdToKick: memberToKick.id });
      toast.success(`${memberToKick.name} was removed`);
    } catch (error) {
      toast.error("Failed to remove member");
    } finally {
      setMemberToKick(null);
    }
  };

  const handleAddNewMember = async (userIdToAdd: string) => {
    try {
      await addMembersMutation({ conversationId, newMemberIds: [userIdToAdd] });
      toast.success("Member added to group!");
      setIsAddingMember(false);
      setAddMemberQuery("");
    } catch (error) {
      toast.error("Failed to add member.");
    }
  };

  const activeTypingUsers = typingIndicators?.filter(t => t.userId !== user?.id) || [];
  const typingNames = activeTypingUsers.map(t => {
    const u = users?.find(u => u.clerkId === t.userId);
    return u ? u.name?.split(' ')[0] : "Someone";
  });

  let typingText = "";
  if (typingNames.length === 1) typingText = `${typingNames[0]} is typing...`;
  else if (typingNames.length === 2) typingText = `${typingNames[0]} and ${typingNames[1]} are typing...`;
  else if (typingNames.length > 2) typingText = "Several people are typing...";

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden" onClick={handleGlobalTap}>

      {messageToDelete && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-xl max-w-sm w-full flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-lg">Delete message?</h3>
              <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Button variant="destructive" onClick={() => executeDelete("for_everyone")} className="w-full justify-start font-medium">
                <Trash2 className="w-4 h-4 mr-2" /> Delete for everyone
              </Button>
              <Button variant="outline" onClick={() => executeDelete("for_me")} className="w-full justify-start font-medium">
                Delete for me
              </Button>
              <Button variant="ghost" onClick={() => setMessageToDelete(null)} className="w-full font-medium">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-xl max-w-sm w-full flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-lg">Leave this group?</h3>
              <p className="text-sm text-muted-foreground mt-1">Choose how you want to leave.</p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Button onClick={() => confirmLeaveGroup(false)} className="w-full justify-start font-medium bg-zinc-100 hover:bg-zinc-200 text-black dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white">
                Leave Group (Keep History)
              </Button>
              <Button variant="destructive" onClick={() => confirmLeaveGroup(true)} className="w-full justify-start font-medium">
                Leave and Delete Group
              </Button>
              <Button variant="ghost" onClick={() => setShowLeaveModal(false)} className="w-full font-medium">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {memberToKick && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-xl max-w-sm w-full flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-lg">Remove {memberToKick.name}?</h3>
              <p className="text-sm text-muted-foreground mt-1">They will be removed from the group but can still view past messages.</p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Button variant="destructive" onClick={confirmKickMember} className="w-full font-medium">
                <UserMinus className="w-4 h-4 mr-2" /> Remove from Group
              </Button>
              <Button variant="ghost" onClick={() => setMemberToKick(null)} className="w-full font-medium">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {memberToChat && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-xl max-w-sm w-full flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-lg">Chat with {memberToChat.name}?</h3>
              <p className="text-sm text-muted-foreground mt-1">This will open a direct message with them.</p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Button onClick={handleStartPrivateChat} className="w-full font-medium">
                <MessageCircle className="w-4 h-4 mr-2" /> Start Chat
              </Button>
              <Button variant="ghost" onClick={() => setMemberToChat(null)} className="w-full font-medium">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-b bg-white dark:bg-zinc-950 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="flex flex-col cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => isGroup ? setShowGroupInfo(true) : setShowUserInfo(true)}
          >
            <div className="flex items-center gap-3">
              {isGroup ? (
                conversation?.groupImageUrl ? (
                  <img src={conversation.groupImageUrl} alt="Group" className="w-8 h-8 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border shadow-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                )
              ) : (
                <Avatar className="w-8 h-8 border shadow-sm">
                  <AvatarImage src={otherUserObj?.imageUrl} />
                  <AvatarFallback className="text-xs font-medium">{otherUserName?.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex flex-col">
                <h3 className="font-semibold text-base leading-none">{isGroup ? conversation?.groupName || otherUserName : otherUserName}</h3>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-1">Tap here for info</span>
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setIsSearching(!isSearching);
          }}
          className={`text-muted-foreground transition-colors ${isSearching ? 'bg-zinc-100 dark:bg-zinc-800 text-foreground' : 'hover:text-foreground'}`}
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {isSearching && (
        <div
          className="absolute top-[76px] left-0 w-full z-30 bg-white dark:bg-zinc-950 border-b dark:border-zinc-800 p-3 shadow-md animate-in slide-in-from-top-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search for messages in this chat..."
              value={searchQueryInput}
              onChange={(e) => setSearchQueryInput(e.target.value)}
              className="pl-9 bg-zinc-100 dark:bg-zinc-900 border-transparent shadow-inner"
            />
            {searchQueryInput && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7 text-muted-foreground" onClick={() => setSearchQueryInput("")}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchQueryInput && searchResults && (
            <div className="mt-3 max-h-64 overflow-y-auto bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-xl shadow-xl divide-y dark:divide-zinc-800">
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-muted-foreground">No matches found.</div>
              ) : (
                searchResults.map(res => (
                  <button key={res._id} onClick={() => scrollToMessage(res._id)} className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <span className="text-[10px] font-bold text-blue-500 mb-1 block uppercase tracking-wider">{formatMessageTime(res._creationTime)}</span>
                    <p className="text-sm truncate text-zinc-700 dark:text-zinc-300 font-medium">{res.content}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {showUserInfo && !isGroup && otherUserObj && (
        <>
          <div
            className="absolute inset-0 z-40 bg-black/5 dark:bg-black/40 backdrop-blur-[1px] transition-all"
            onClick={() => setShowUserInfo(false)}
          />
          <div className="absolute top-0 right-0 h-full w-full sm:w-80 bg-white dark:bg-zinc-950 border-l dark:border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b flex items-center gap-3 shrink-0 bg-zinc-50 dark:bg-zinc-900/50">
              <Button variant="ghost" size="icon" onClick={() => setShowUserInfo(false)} className="-ml-2 shrink-0">
                <X className="h-5 w-5" />
              </Button>
              <h2 className="font-bold text-lg truncate">User Info</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col items-center justify-center gap-1 mt-6">
                <Avatar className="h-24 w-24 border shadow-sm">
                  <AvatarImage src={otherUserObj.imageUrl} />
                  <AvatarFallback className="text-3xl">{otherUserObj.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <h3 className="font-bold text-xl mt-4 px-6 text-center">{otherUserObj.name}</h3>
              </div>

              <div className="flex flex-col gap-3 mt-8">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Settings</p>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 rounded-xl"
                  onClick={async () => {
                    try {
                      await togglePin({ conversationId });
                      toast.success(isPinned ? "Conversation unpinned" : "Conversation pinned");
                    } catch (error) {
                      toast.error("Failed to pin conversation");
                    }
                  }}
                >
                  <Pin className={`h-4 w-4 mr-3 ${isPinned ? "fill-current text-blue-500" : "text-muted-foreground"}`} />
                  {isPinned ? "Unpin Conversation" : "Pin Conversation"}
                </Button>
              </div>
            </div>

            <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
              <Button
                variant={isBlockedByMe ? "default" : "destructive"}
                className="w-full font-bold h-12 rounded-xl"
                onClick={async () => {
                  if (!otherUserId) return;
                  try {
                    await toggleBlockUser({ clerkIdToToggle: otherUserId });
                    toast.success(isBlockedByMe ? "User unblocked" : "User blocked");
                  } catch (error) {
                    toast.error("Failed to update block status");
                  }
                }}
              >
                <Ban className="h-4 w-4 mr-2" />
                {isBlockedByMe ? "Unblock User" : "Block User"}
              </Button>
            </div>
          </div>
        </>
      )}

      {showGroupInfo && isGroup && conversation && (
        <>
          <div
            className="absolute inset-0 z-40 bg-black/5 dark:bg-black/40 backdrop-blur-[1px] transition-all"
            onClick={() => { setShowGroupInfo(false); setIsEditingGroup(false); setIsAddingMember(false); }}
          />

          <div className="absolute top-0 right-0 h-full w-full sm:w-80 bg-white dark:bg-zinc-950 border-l dark:border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">

            <div className="p-4 border-b flex items-center gap-3 shrink-0 bg-zinc-50 dark:bg-zinc-900/50">
              <Button variant="ghost" size="icon" onClick={() => setShowGroupInfo(false)} className="-ml-2 shrink-0">
                <X className="h-5 w-5" />
              </Button>
              <h2 className="font-bold text-lg truncate">{isAddingMember ? "Add Members" : "Group Info"}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {isAddingMember ? (
                <div className="space-y-4 animate-in fade-in">
                  <Input
                    placeholder="Search users to add..."
                    value={addMemberQuery || ""}
                    onChange={(e) => setAddMemberQuery(e.target.value)}
                    className="bg-zinc-100 dark:bg-zinc-900"
                  />
                  <div className="space-y-2">
                    {users?.filter(u =>
                      !conversation.groupMembers?.includes(u.clerkId) &&
                      u.name?.toLowerCase().includes(addMemberQuery.toLowerCase())
                    ).map(u => (
                      <div key={u._id} className="flex items-center justify-between p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8"><AvatarImage src={u.imageUrl} /><AvatarFallback>{u.name?.charAt(0)}</AvatarFallback></Avatar>
                          <span className="text-sm font-medium">{u.name}</span>
                        </div>
                        <Button size="sm" onClick={() => handleAddNewMember(u.clerkId)}>Add</Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" className="w-full mt-4" onClick={() => setIsAddingMember(false)}>Back to Group Info</Button>
                </div>
              ) : (
                <>
                  <div className="text-center space-y-3">

                    <div className="relative inline-block mx-auto">
                      {conversation.groupImageUrl ? (
                        <img src={conversation.groupImageUrl} alt="Group Avatar" className="h-24 w-24 rounded-2xl object-cover border shadow-sm" />
                      ) : (
                        <div className="bg-zinc-100 dark:bg-zinc-900 h-24 w-24 rounded-2xl flex items-center justify-center border shadow-sm">
                          <Users className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}

                      {isAdmin && !isEditingGroup && (
                        <button
                          onClick={() => {
                            setEditNameValue(conversation.groupName || "");
                            setEditDescValue(conversation.groupDescription || "");
                            setEditImgValue(conversation.groupImageUrl || "");
                            setIsEditingGroup(true);
                          }}
                          className="absolute -bottom-2 -right-2 bg-zinc-900 text-white dark:bg-white dark:text-black p-2 rounded-full shadow-md hover:scale-110 transition-transform z-10"
                          title="Edit Group Details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {isEditingGroup ? (
                      <div className="flex flex-col gap-3 mx-auto animate-in fade-in p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border dark:border-zinc-800 text-left mt-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Group Name</label>
                          <Input value={editNameValue || ""} onChange={(e) => setEditNameValue(e.target.value)} className="h-8 bg-white dark:bg-zinc-950 mt-1" autoFocus />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Description</label>
                          <Input placeholder="What's this group about?" value={editDescValue || ""} onChange={(e) => setEditDescValue(e.target.value)} className="h-8 bg-white dark:bg-zinc-950 mt-1" />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Update Image</label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="h-8 bg-white dark:bg-zinc-950 mt-1 text-xs cursor-pointer file:mr-2 file:py-0 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-900 hover:file:bg-zinc-200"
                          />
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="ghost" className="flex-1" onClick={() => setIsEditingGroup(false)}>Cancel</Button>
                          <Button size="sm" className="flex-1" onClick={handleSaveGroupDetails}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <h3 className="font-bold text-xl px-6">{conversation.groupName}</h3>
                        {conversation.groupDescription && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 px-4">{conversation.groupDescription}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">{conversation.groupMembers?.length} Members</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Settings</p>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12 rounded-xl mb-4"
                      onClick={async () => {
                        try {
                          await togglePin({ conversationId });
                          toast.success(isPinned ? "Conversation unpinned" : "Conversation pinned");
                        } catch (error) {
                          toast.error("Failed to pin conversation");
                        }
                      }}
                    >
                      <Pin className={`h-4 w-4 mr-3 ${isPinned ? "fill-current text-blue-500" : "text-muted-foreground"}`} />
                      {isPinned ? "Unpin Conversation" : "Pin Conversation"}
                    </Button>

                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Members</p>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border dark:border-zinc-800 overflow-hidden divide-y dark:divide-zinc-800">
                      {conversation.groupMembers?.map((memberId) => {
                        const isMe = user?.id === memberId;
                        const isThisUserAdmin = conversation.groupAdmin === memberId;

                        const memberUser = isMe && user ? {
                          clerkId: user.id,
                          name: user.fullName || user.firstName || "You",
                          imageUrl: user.imageUrl
                        } : users?.find(u => u.clerkId === memberId);

                        if (!memberUser) return null;

                        return (
                          <div
                            key={memberId}
                            className={`flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 group/member ${!isMe ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors" : ""}`}
                            onClick={() => {
                              if (!isMe) setMemberToChat({ id: memberUser.clerkId, name: memberUser.name || "User" });
                            }}
                          >
                            <Avatar className="h-10 w-10 border border-black/5 dark:border-white/10 shadow-sm">
                              <AvatarImage src={memberUser.imageUrl} />
                              <AvatarFallback>{memberUser.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate flex items-center gap-2">
                                {memberUser.name}
                                {isMe && <span className="text-xs text-muted-foreground font-normal">(You)</span>}
                              </p>
                            </div>

                            {isThisUserAdmin && (
                              <div className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-500 px-2 py-1 rounded-md gap-1">
                                <Crown className="h-3 w-3" /> Admin
                              </div>
                            )}

                            {isAdmin && !isMe && (
                              <button
                                onClick={(e) => handleKickMemberClick(e, memberId, memberUser.name || "User")}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-opacity opacity-100 md:opacity-0 md:group-hover/member:opacity-100"
                                title={`Kick ${memberUser.name}`}
                              >
                                <UserMinus className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {isAdmin && (
                      <Button variant="outline" className="w-full border-dashed" onClick={() => setIsAddingMember(true)}>
                        <UserPlus className="h-4 w-4 mr-2" /> Add Members
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
              <Button variant="destructive" className="w-full font-bold h-12 rounded-xl" onClick={() => setShowLeaveModal(true)}>
                <LogOut className="h-4 w-4 mr-2" />
                Leave Group
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-900" onScroll={handleScroll}>
        <div className="flex flex-col gap-4 pb-4">
          {messages === undefined ? (
            <div className="flex flex-col gap-4 w-full pt-4 animate-pulse px-2">
              <div className="flex justify-start"><Skeleton className="h-10 w-[60%] rounded-2xl rounded-bl-sm bg-zinc-200 dark:bg-zinc-800" /></div>
              <div className="flex justify-end"><Skeleton className="h-10 w-[40%] rounded-2xl rounded-br-sm bg-zinc-200 dark:bg-zinc-800" /></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center mt-32 gap-3 opacity-70">
              <MessageCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">No messages yet. Be the first to say hi!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId === user?.id;
              const sender = isGroup ? users?.find(u => u.clerkId === msg.senderId) : null;
              const isFirstInGroup = index === 0 || messages[index - 1].senderId !== msg.senderId;

              const reactionCounts = (msg.reactions || []).reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              const myReactions = new Set((msg.reactions || []).filter(r => r.userId === user?.id).map(r => r.emoji));
              const repliedMessage = msg.replyTo ? messages.find(m => m._id === msg.replyTo) : null;
              const repliedSenderName = repliedMessage ? (repliedMessage.senderId === user?.id ? "You" : (isGroup ? users?.find(u => u.clerkId === repliedMessage.senderId)?.name : otherUserName)) : "Someone";
              const isSwiping = (swipeOffset[msg._id] || 0) > 0;

              let isRead = false;
              if (conversation && isMe) {
                if (conversation.isGroup) {
                  const otherMembers = conversation.groupMembers?.filter(id => id !== user?.id) || [];
                  if (otherMembers.length > 0) {
                    isRead = otherMembers.every(memberId => {
                      const receipt = conversation.memberLastRead?.find(r => r.userId === memberId);
                      return receipt && receipt.lastRead >= msg._creationTime;
                    });
                  }
                } else {
                  const isParticipantOne = conversation.participantOne === user?.id;
                  const otherLastRead = isParticipantOne ? conversation.participantTwoLastRead : conversation.participantOneLastRead;
                  isRead = (otherLastRead || 0) >= msg._creationTime;
                }
              }

              return (
                <div
                  id={`msg-container-${msg._id}`}
                  key={msg._id}
                  // FIX 1: Added relative and w-full so we can position absolute children directly in the center of the column
                  className={`relative w-full flex flex-col gap-1 group ${isMe ? "items-end" : "items-start"} ${isFirstInGroup ? "mt-2" : "mt-0"} ${highlightedMessageId === msg._id ? "bg-blue-500/20 dark:bg-blue-500/30 p-2 rounded-xl transition-all duration-500" : "transition-all duration-500 p-0"}`}
                  onTouchStart={(e) => handleTouchStart(e, msg._id)}
                  onTouchEnd={() => handleTouchEnd(msg._id, msg.content, sender?.name || (isMe ? "You" : otherUserName))}
                  onTouchMove={(e) => handleTouchMove(e, msg._id)}
                  style={{
                    transform: `translateX(${swipeOffset[msg._id] || 0}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                >

                  {/* FIX 2: Moved Reaction Palette to the very root of the message container and centered it */}
                  {selectedMessageForReaction === msg._id && (
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 ${index >= messages.length - 2 ? "bottom-full mb-1" : "top-full mt-1"
                        } bg-white dark:bg-zinc-950 border dark:border-zinc-800 shadow-xl rounded-full p-1 flex gap-1 z-[100] animate-in zoom-in-95 duration-200`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleReaction(msg._id, emoji);
                            setSelectedMessageForReaction(null);
                            setMobileActiveMessage(null);
                          }}
                          className="w-8 h-8 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-lg transition-transform hover:scale-125"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {isGroup && !isMe && isFirstInGroup && sender && (
                    <span className="text-[10px] font-medium text-muted-foreground ml-10 mb-0.5">{sender.name}</span>
                  )}

                  <div className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} relative`}>

                    {isGroup && !isMe && (
                      <div className="w-8 shrink-0 flex justify-center">
                        {isFirstInGroup ? (
                          <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity border border-black/5 dark:border-white/10 shadow-sm" onClick={() => setMemberToChat({ id: sender?.clerkId || "", name: sender?.name || "User" })}>
                            <AvatarImage src={sender?.imageUrl} />
                            <AvatarFallback className="text-[10px]">{sender?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        ) : <div className="w-8" />}
                      </div>
                    )}

                    <div
                      className={`max-w-[75%] px-4 py-2 relative flex flex-col gap-1 ${msg.isDeleted
                        ? "bg-transparent border border-zinc-200 dark:border-zinc-800 text-muted-foreground italic rounded-2xl"
                        : isMe
                          ? "bg-black text-white dark:bg-white dark:text-black rounded-2xl rounded-br-sm shadow-sm"
                          : "bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white rounded-2xl rounded-bl-sm shadow-sm"
                        }`}
                    >
                      {repliedMessage && !msg.isDeleted && (
                        <div className={`p-2 rounded-lg text-xs border-l-4 opacity-80 ${isMe ? "bg-white/20 dark:bg-black/10 border-white/50 dark:border-zinc-500" : "bg-black/5 dark:bg-black/30 border-black/30 dark:border-zinc-500"} cursor-pointer hover:opacity-100 transition-opacity`}
                          onClick={() => { const el = document.getElementById(`msg-container-${repliedMessage._id}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                          <span className="font-bold block mb-0.5">{repliedSenderName}</span>
                          <span className="line-clamp-2">{repliedMessage.content}</span>
                        </div>
                      )}

                      {editingMessageId === msg._id ? (
                        <div
                          className="flex flex-col gap-2 w-full max-w-full overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={editMessageContent}
                            onChange={(e) => setEditMessageContent(e.target.value)}
                            className=" h-8 w-full max-w-full box-border text-sm bg-zinc-100 dark:bg-zinc-900  text-zinc-900 dark:text-zinc-100  border border-zinc-300 dark:border-zinc-700 shadow-sm  whitespace-pre-wrap break-words focus-visible:ring-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') setEditingMessageId(null);
                            }}
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => setEditingMessageId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 px-3 text-xs"
                              onClick={handleSaveEdit}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : msg.isDeleted ? (
                        <div className="flex items-center gap-2 text-xs opacity-70"><Ban className="h-3 w-3" />This message was deleted</div>
                      ) : (
                        <div>
                          {renderMessageContent(msg.content)}
                        </div>
                      )}

                      {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                        <div className={`absolute -bottom-4 ${isMe ? "right-0" : "left-0"} flex gap-1 z-10`}>
                          {Object.entries(reactionCounts).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg._id, emoji); }}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm transition-transform hover:scale-110 flex items-center gap-1 ${myReactions.has(emoji) ? "bg-blue-100 border-blue-200 dark:bg-blue-900/50 dark:border-blue-800" : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"}`}
                            >
                              <span>{emoji}</span><span className="font-bold text-muted-foreground">{count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={`flex items-center gap-1 transition-all duration-200 mb-1 ${mobileActiveMessage === msg._id
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"
                      }`}>
                      {/* The Smile button now just triggers the state change, UI is handled at the root */}
                      <button onClick={(e) => { e.stopPropagation(); setSelectedMessageForReaction(selectedMessageForReaction === msg._id ? null : msg._id); }} className="p-1.5 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><Smile className="h-4 w-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setReplyingTo({ id: msg._id, content: msg.content, senderName: sender?.name || (isMe ? "You" : otherUserName) }); }} className="p-1.5 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors" title="Reply"><Reply className="h-4 w-4" /></button>

                      {isMe && (
                        <button onClick={(e) => { e.stopPropagation(); setEditingMessageId(msg._id); setEditMessageContent(msg.content); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-full transition-colors" title="Edit message"><Pencil className="h-4 w-4" /></button>
                      )}

                      {isMe && <button onClick={(e) => { e.stopPropagation(); setMessageToDelete(msg._id); }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors" title="Delete message"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>

                  <div className={`text-[10px] text-muted-foreground flex items-center gap-1 ${isGroup && !isMe ? "ml-10" : "px-1"} ${msg.reactions && msg.reactions.length > 0 && !msg.isDeleted ? "mt-3" : ""}`}>
                    <span>{formatMessageTime(msg._creationTime)}</span>
                    {msg.isEdited && !msg.isDeleted && <span className="italic">(edited)</span>}
                    {isMe && !msg.isDeleted && (
                      isRead ? (
                        <CheckCheck className="h-3.5 w-3.5 text-blue-500 animate-in zoom-in duration-300" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-zinc-400" />
                      )
                    )}
                  </div>

                </div>
              );
            })
          )}

          {activeTypingUsers.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {isGroup && <div className="w-8 shrink-0" />}
              <div className="bg-zinc-200 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1 w-fit h-9">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
              </div>
              <span className="text-xs text-muted-foreground animate-pulse">{typingText}</span>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      {showScrollButton && (
        <Button onClick={(e) => { e.stopPropagation(); scrollToBottom(); }} className="absolute bottom-20 left-1/2 transform -translate-x-1/2 rounded-full shadow-lg z-20" size="sm">
          <ArrowDown className="h-4 w-4 mr-1" />New messages
        </Button>
      )}

      <div className="border-t bg-white dark:bg-zinc-950 relative z-20 shrink-0 pb-1">
        {mentionQuery !== null && isGroup && (
          <div className="absolute bottom-full left-4 mb-2 w-64 bg-white dark:bg-zinc-950 border dark:border-zinc-800 shadow-xl rounded-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
            <div className="p-2 bg-zinc-50 dark:bg-zinc-900 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider">Members</div>
            <div className="max-h-48 overflow-y-auto p-1">
              {conversation?.groupMembers?.map(id => users?.find(u => u.clerkId === id)).filter(u => u && u.name?.replace(/\s+/g, "").toLowerCase().includes(mentionQuery)).map(u => {
                if (!u) return null;
                return (
                  <button key={u.clerkId} type="button" onClick={() => handleMentionSelect(u.name || "User")} className="w-full flex items-center gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left">
                    <Avatar className="h-6 w-6"><AvatarImage src={u.imageUrl} /><AvatarFallback className="text-[10px]">{u.name?.charAt(0)}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium">{u.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {replyingTo && (
          <div className="mx-4 mt-3 mb-1 p-3 bg-zinc-100 dark:bg-zinc-900/80 border-l-4 border-blue-500 rounded-xl flex justify-between items-center animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex flex-col min-w-0 pr-4">
              <span className="text-xs font-bold text-blue-500 truncate mb-0.5">Replying to {replyingTo.senderName}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{replyingTo.content}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="shrink-0 p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"><X className="h-4 w-4 text-zinc-500" /></button>
          </div>
        )}

        {!isChatReady ? (
          <div className="flex gap-2 p-4 opacity-50 pointer-events-none">
            <Skeleton className="flex-1 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ) : isBlockedByMe ? (
          <div className="flex items-center justify-center p-4 m-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-sm text-muted-foreground font-medium border border-zinc-200 dark:border-zinc-800">
            You blocked this user. Unblock them to send messages.
          </div>
        ) : hasBlockedMe ? (
          <div className="flex items-center justify-center p-4 m-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-sm text-muted-foreground font-medium border border-zinc-200 dark:border-zinc-800">
            You cannot reply to this conversation.
          </div>
        ) : isPastMember ? (
          <div className="flex items-center justify-center p-4 m-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-sm text-muted-foreground font-medium border border-zinc-200 dark:border-zinc-800">
            You left this group. You cannot send new messages.
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2 p-4">
            <Input value={newMessage || ""} onChange={handleInputChange} placeholder="Type a message..." className="flex-1 bg-zinc-100 dark:bg-zinc-900 border-transparent focus-visible:ring-1" />
            <Button type="submit" size="icon" disabled={!newMessage.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        )}
      </div>
    </div>
  );
}