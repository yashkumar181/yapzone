"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatAreaProps {
  conversationId: Id<"conversations">;
  otherUserName: string;
}

export function ChatArea({ conversationId, otherUserName }: ChatAreaProps) {
  const { user } = useUser();
  
  // Real-time subscription to messages in this specific chat
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  
  const [newMessage, setNewMessage] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage(""); // Optimistically clear the input instantly

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
      {/* Chat Header */}
      <div className="p-4 border-b bg-white dark:bg-zinc-950 flex items-center shadow-sm z-10">
        <h3 className="font-semibold text-lg">Chatting with {otherUserName}</h3>
      </div>

      {/* Message List */}
      <ScrollArea className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 pb-4">
          {messages === undefined ? (
            <p className="text-center text-sm text-muted-foreground mt-4">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground mt-10">
              No messages yet. Say hi!
            </p>
          ) : (
            messages.map((msg) => {
              // Check if the message was sent by the currently logged-in user
              const isMe = msg.senderId === user?.id;
              
              return (
                <div
                  key={msg._id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
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
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Message Input Area */}
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