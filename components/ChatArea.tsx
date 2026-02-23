"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send, MessageCircle, ArrowLeft, ArrowDown, Trash2, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMessageTime } from "@/lib/utils";

interface ChatAreaProps {
  conversationId: Id<"conversations">;
  otherUserName: string;
  onClose: () => void;
}

export function ChatArea({ conversationId, otherUserName, onClose }: ChatAreaProps) {
  const { user } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedChatRef = useRef<string | null>(null);
  
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.remove);
  
  const typingIndicators = useQuery(api.typing.getActive, { conversationId });
  const startTyping = useMutation(api.typing.start);
  const stopTyping = useMutation(api.typing.stop);
  const markAsRead = useMutation(api.conversations.markAsRead);
  
  const [newMessage, setNewMessage] = useState("");
  const lastTypingTimeRef = useRef<number>(0);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // NEW: State for our custom Delete Modal
  const [messageToDelete, setMessageToDelete] = useState<Id<"messages"> | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop <= clientHeight + 50; 
    setIsAtBottom(atBottom);
    if (atBottom) setShowScrollButton(false);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setShowScrollButton(false);
  };

  useEffect(() => {
    if (messages) {
      markAsRead({ conversationId }).catch(() => {});

      if (loadedChatRef.current !== conversationId) {
        scrollRef.current?.scrollIntoView({ behavior: "auto" });
        loadedChatRef.current = conversationId;
      } else if (isAtBottom) {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        if (messages.length > 0) setShowScrollButton(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, conversationId, markAsRead]); 

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

    const content = newMessage.trim();
    setNewMessage(""); 
    stopTyping({ conversationId });

    setIsAtBottom(true);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      await sendMessage({ conversationId, content });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // NEW: Handler for the modal buttons
  const executeDelete = async (type: "for_me" | "for_everyone") => {
    if (!messageToDelete) return;
    try {
      await deleteMessage({ messageId: messageToDelete, type });
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setMessageToDelete(null); // Close modal
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      
      {/* NEW: The Premium Delete Modal Overlay */}
      {messageToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
        <h3 className="font-semibold text-lg">Chatting with {otherUserName}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-900" onScroll={handleScroll}>
        <div className="flex flex-col gap-4 pb-4">
          {messages === undefined ? (
            <p className="text-center text-sm text-muted-foreground mt-4">Loading messages...</p>
          ) : messages.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center mt-32 gap-3 opacity-70">
              <MessageCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                No messages yet. Be the first to say hi!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg._id} className={`flex flex-col gap-1 group ${isMe ? "items-end" : "items-start"}`}>
                  
                  <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2 ${
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
                    </div>

                    {/* Show trash icon to open modal */}
                    {isMe && !msg.isDeleted && (
                      <button
                        onClick={() => setMessageToDelete(msg._id)}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full shrink-0"
                        title="Delete message"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-muted-foreground px-1">{formatMessageTime(msg._creationTime)}</span>
                </div>
              );
            })
          )}

          {typingIndicators && typingIndicators.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
               <div className="bg-zinc-200 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1 w-fit h-9">
                 <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                 <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                 <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
               </div>
               <span className="text-xs text-muted-foreground animate-pulse">{otherUserName} is typing...</span>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </div>

      {showScrollButton && (
        <Button 
          onClick={scrollToBottom}
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