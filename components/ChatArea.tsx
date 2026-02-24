"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send, MessageCircle, ArrowLeft, ArrowDown, Trash2, Ban, Smile } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMessageTime } from "@/lib/utils";
import { toast } from "sonner"; 
import { Skeleton } from "@/components/ui/skeleton"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // NEW: For group avatars

interface ChatAreaProps {
  conversationId: Id<"conversations">;
  otherUserName: string;
  isGroup?: boolean; // FIXED: Now accepts the isGroup prop
  onClose: () => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export function ChatArea({ conversationId, otherUserName, isGroup, onClose }: ChatAreaProps) {
  const { user } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedChatRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);
  
  const messages = useQuery(api.messages.list, { conversationId });
  const users = useQuery(api.users.getUsers); // NEW: Fetch users to get names/avatars for group chat
  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.remove);
  const toggleReaction = useMutation(api.messages.react);
  
  const typingIndicators = useQuery(api.typing.getActive, { conversationId });
  const startTyping = useMutation(api.typing.start);
  const stopTyping = useMutation(api.typing.stop);
  const markAsRead = useMutation(api.conversations.markAsRead);
  
  const [newMessage, setNewMessage] = useState("");
  const lastTypingTimeRef = useRef<number>(0);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const [messageToDelete, setMessageToDelete] = useState<Id<"messages"> | null>(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<Id<"messages"> | null>(null);

  const [mobileActiveMessage, setMobileActiveMessage] = useState<Id<"messages"> | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleGlobalTap = () => {
    if (mobileActiveMessage) setMobileActiveMessage(null);
    if (selectedMessageForReaction) setSelectedMessageForReaction(null);
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
      if (!isGroup) markAsRead({ conversationId }).catch(() => {});

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, conversationId, markAsRead, isGroup]); 

  useEffect(() => {
    if (isAtBottom && typingIndicators && typingIndicators.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingIndicators]); 

  useEffect(() => {
    return () => {
      stopTyping({ conversationId }).catch(() => {});
    };
  }, [conversationId, stopTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (value.trim() === "") {
      stopTyping({ conversationId });
      return;
    }

    const now = Date.now();
    if (now - lastTypingTimeRef.current > 1000) {
      startTyping({ conversationId });
      lastTypingTimeRef.current = now;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (!navigator.onLine) {
      toast.error("You are offline. Please check your connection.");
      return;
    }

    const content = newMessage.trim();
    setNewMessage(""); 
    stopTyping({ conversationId });

    setIsAtBottom(true);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      await sendMessage({ conversationId, content });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
      setNewMessage(content); 
    }
  };

  const executeDelete = async (type: "for_me" | "for_everyone") => {
    if (!messageToDelete) return;
    try {
      await deleteMessage({ messageId: messageToDelete, type });
      toast.success("Message deleted"); 
    } catch (error) {
      console.error("Failed to delete:", error);
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
      console.error("Failed to react:", error);
      toast.error("Could not add reaction."); 
    }
  };
  
  const handleTouchStart = (msgId: Id<"messages">) => {
    if (mobileActiveMessage !== msgId) {
      setMobileActiveMessage(null);
      setSelectedMessageForReaction(null);
    }

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setMobileActiveMessage(msgId);
    }, 400); 
  };

  const handleTouchEndOrMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative" onClick={handleGlobalTap}>
      
      {messageToDelete && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()} 
        >
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

      <div className="p-4 border-b bg-white dark:bg-zinc-950 flex items-center gap-2 shadow-sm z-10">
        <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col">
          <h3 className="font-semibold text-lg">{otherUserName}</h3>
          {/* Show a subtle badge if it's a group */}
          {isGroup && <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Group Chat</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-900" onScroll={handleScroll}>
        <div className="flex flex-col gap-4 pb-4">
          {messages === undefined ? (
            <div className="flex flex-col gap-4 w-full pt-4 animate-pulse px-2">
              <div className="flex justify-start">
                <Skeleton className="h-10 w-[60%] rounded-2xl rounded-bl-sm bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-[40%] rounded-2xl rounded-br-sm bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-16 w-[50%] rounded-2xl rounded-br-sm bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="flex justify-start">
                <Skeleton className="h-10 w-[45%] rounded-2xl rounded-bl-sm bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ) : messages.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center mt-32 gap-3 opacity-70">
              <MessageCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                No messages yet. Be the first to say hi!
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId === user?.id;
              
              // NEW: Get sender details for group chat
              const sender = isGroup ? users?.find(u => u.clerkId === msg.senderId) : null;
              
              // NEW: Check if the previous message was from the same sender to group them visually
              const isFirstInGroup = index === 0 || messages[index - 1].senderId !== msg.senderId;

              const reactionCounts = (msg.reactions || []).reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              const myReactions = new Set(
                (msg.reactions || []).filter(r => r.userId === user?.id).map(r => r.emoji)
              );

              return (
                <div 
                  key={msg._id} 
                  className={`flex flex-col gap-1 group ${isMe ? "items-end" : "items-start"} ${isFirstInGroup ? "mt-2" : "mt-0"}`}
                  onTouchStart={() => handleTouchStart(msg._id)}
                  onTouchEnd={handleTouchEndOrMove}
                  onTouchMove={handleTouchEndOrMove}
                >
                  
                  {/* NEW: Render Sender Name for incoming group messages */}
                  {isGroup && !isMe && isFirstInGroup && sender && (
                    <span className="text-[10px] font-medium text-muted-foreground ml-10 mb-0.5">
                      {sender.name}
                    </span>
                  )}

                  <div className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} relative`}>
                    
                    {/* NEW: Tiny Avatar for Group Chats */}
                    {isGroup && !isMe && (
                      <div className="w-8 shrink-0 flex justify-center">
                         {isFirstInGroup ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={sender?.imageUrl} />
                              <AvatarFallback className="text-[10px]">{sender?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                         ) : (
                           <div className="w-8" /> // Empty placeholder to align grouped messages
                         )}
                      </div>
                    )}

                    <div
                      className={`max-w-[75%] px-4 py-2 relative ${
                        msg.isDeleted
                          ? "bg-transparent border border-zinc-200 dark:border-zinc-800 text-muted-foreground italic rounded-2xl"
                          : isMe
                          ? "bg-black text-white dark:bg-white dark:text-black rounded-2xl rounded-br-sm shadow-sm"
                          : "bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white rounded-2xl rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {msg.isDeleted ? (
                        <div className="flex items-center gap-2 text-xs opacity-70">
                          <Ban className="h-3 w-3" />
                          This message was deleted
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}

                      {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                        <div className={`absolute -bottom-4 ${isMe ? "right-0" : "left-0"} flex gap-1 z-10`}>
                          {Object.entries(reactionCounts).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReaction(msg._id, emoji);
                              }}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm transition-transform hover:scale-110 flex items-center gap-1 ${
                                myReactions.has(emoji)
                                  ? "bg-blue-100 border-blue-200 dark:bg-blue-900/50 dark:border-blue-800"
                                  : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-bold text-muted-foreground">{count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!msg.isDeleted && (
                      <div className={`flex items-center gap-1 transition-opacity duration-200 mb-1 ${
                        mobileActiveMessage === msg._id ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"
                      }`}>
                        
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMessageForReaction(selectedMessageForReaction === msg._id ? null : msg._id);
                            }}
                            className="p-1.5 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                          >
                            <Smile className="h-4 w-4" />
                          </button>

                          {selectedMessageForReaction === msg._id && (
                            <div 
                              className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-950 border dark:border-zinc-800 shadow-xl rounded-full p-1 flex gap-1 z-50 animate-in zoom-in-95 duration-200"
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
                                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-lg transition-transform hover:scale-125"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {isMe && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessageToDelete(msg._id);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
                            title="Delete message"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <span className={`text-[10px] text-muted-foreground ${isGroup && !isMe ? "ml-10" : "px-1"} ${msg.reactions && msg.reactions.length > 0 && !msg.isDeleted ? "mt-3" : ""}`}>
                    {formatMessageTime(msg._creationTime)}
                  </span>
                </div>
              );
            })
          )}

          {typingIndicators && typingIndicators.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
               {isGroup && <div className="w-8 shrink-0" />} {/* Spacer for typing indicator alignment in groups */}
               <div className="bg-zinc-200 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1 w-fit h-9">
                 <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                 <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                 <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
               </div>
               <span className="text-xs text-muted-foreground animate-pulse">
                 {typingIndicators.length === 1 ? `${otherUserName.split(',')[0]} is typing...` : "Several people are typing..."}
               </span>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </div>

      {showScrollButton && (
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            scrollToBottom();
          }}
          className="absolute bottom-20 left-1/2 transform -translate-x-1/2 rounded-full shadow-lg z-20"
          size="sm"
        >
          <ArrowDown className="h-4 w-4 mr-1" />
          New messages
        </Button>
      )}

      <div className="p-4 border-t bg-white dark:bg-zinc-950">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-900 border-transparent focus-visible:ring-1"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}