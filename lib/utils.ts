import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add this to the bottom of lib/utils.ts

export function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    // Example: "2:34 PM"
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  if (isThisYear) {
    // Example: "Feb 15, 2:34 PM"
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Example: "Feb 15, 2025, 2:34 PM"
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}