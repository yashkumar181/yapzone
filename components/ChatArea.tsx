"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send, MessageCircle, ArrowLeft } from "lucide-react"; // NEW: ArrowLeft imported
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMessageTime } from "@/lib/utils";

interface ChatAreaProps {
  conversationId: Id<"conversations">;
  otherUserName: string;
  onClose: () => void; // NEW: Prop to close chat on mobile
}

export function ChatArea({ conversationId, otherUserName, onClose }: ChatAreaProps) {
  const { user } = useUser();
  
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  
  const [newMessage, setNewMessage] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage(""); 

    try {
      await sendMessage({
        conversationId,
        content,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* UPDATED: Added gap-2 and the Back button */}
      <div className="p-4 border-b bg-white dark:bg-zinc-950 flex items-center gap-2 shadow-sm z-10">
        <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h3 className="font-semibold text-lg">Chatting with {otherUserName}</h3>
      </div>

      <ScrollArea className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-900">
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
                <div
                  key={msg._id}
                  className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                      isMe
                        ? "bg-black text-white dark:bg-white dark:text-black rounded-br-sm"
                        : "bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {formatMessageTime(msg._creationTime)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white dark:bg-zinc-950">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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