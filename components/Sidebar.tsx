"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton } from "@clerk/nextjs";

export function Sidebar() {
  const users = useQuery(api.users.getUsers);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter users based on the search bar input
  const filteredUsers = users?.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 h-screen border-r bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header & Search */}
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

      {/* User List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {users === undefined ? (
            // Loading State
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))
          ) : filteredUsers?.length === 0 ? (
            // Empty State (Feature 5 preview!)
            <p className="text-center text-sm text-muted-foreground p-4">
              No users found.
            </p>
          ) : (
            // Render filtered users
            filteredUsers?.map((user) => (
              <button
                key={user._id}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-left"
                onClick={() => console.log("Start chat with", user.name)}
              >
                <Avatar>
                  <AvatarImage src={user.imageUrl} />
                  <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm truncate">
                  {user.name}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}