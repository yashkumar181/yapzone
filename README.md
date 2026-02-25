# ⚡ YapZone - Real-Time Chat Architecture

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Convex-Backend-orange?style=for-the-badge&logo=convex" alt="Convex" />
  <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk" alt="Clerk" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
</div>

<br />

> A high-performance, real-time messaging platform designed for seamless and instant communication. YapZone goes beyond basic CRUD architecture, delivering a premium user experience by implementing complex state management, fluid UI rendering, robust backend security, and lightning-fast full-text search indexing.

### 🔗 Quick Links
- **🔴 Live Application:** [https://yapzone.vercel.app/]
- **💻 GitHub Repository:** [https://github.com/yashkumar181/yapzone]

---

## 📸 Platform Gallery

### Desktop Experience
| Main Messaging Interface & Group Info | Full-Text Search & Pinned Chats |
| :---: | :---: |
| <img src="https://placehold.co/600x350/18181b/ffffff?text=Add+Desktop+Main+Screenshot+Here" alt="Main UI" width="100%"> | <img src="https://placehold.co/600x350/18181b/ffffff?text=Add+Search/Pin+Screenshot+Here" alt="Search UI" width="100%"> |

### Mobile Experience
| Responsive Sidebar & Presence | Dynamic Reaction Palette (Touch) |
| :---: | :---: |
| <img src="https://placehold.co/300x500/18181b/ffffff?text=Add+Mobile+Sidebar+Screenshot" alt="Mobile Sidebar" width="100%"> | <img src="https://placehold.co/300x500/18181b/ffffff?text=Add+Mobile+Reaction+Screenshot" alt="Mobile Reaction" width="100%"> |

---

## ✨ Standout Features

YapZone was built with an obsessive focus on edge cases, mobile UX, and database security. 

### 🛡️ Advanced Core Mechanics
- **Full-Text Search:** Implemented `.searchIndex()` on the backend. Users can instantly search chat histories, and the UI dynamically scrolls to and highlights the queried message.
- **Mutual Blocking Engine:** Secure backend logic utilizing `ConvexError`. If User A blocks User B, the UI completely removes the input field, and backend mutations immediately reject unauthorized API requests.
- **Conversation Pinning:** Custom array sorting logic allows users to anchor priority 1-on-1s or Group Chats to the top of their feed.
- **Granular Read Receipts:** Tracks exact `lastReadAt` timestamps per user, displaying intelligent "Seen" checkmarks only when appropriate.

### 💬 Rich Messaging Experience
- **Dynamic Reaction Palette:** A mathematically positioned emoji tooltip that calculates its distance from the screen edge to prevent UI clipping on mobile devices.
- **Edit & Delete (For Me / Everyone):** Full CRUD control over messages. Edited messages receive an `(edited)` tag, and deleted messages are scrubbed directly from the Convex database.
- **Contextual Replies:** Swipe-to-reply (mobile) and click-to-reply (desktop) logic that generates a scrollable reference anchor to the original message.
- **Live Presence & Typing:** Real-time green dot indicators for online users, and accurate `[User] is typing...` states managed via Convex time-expiring documents.

### 👥 Comprehensive Group Management
- **Admin Controls:** Creators can kick members, add new users, and update the group's avatar and description.
- **Graceful Exits:** Users can leave a group but keep their read history, or completely scrub the group from their local view.

---

## 🛠️ Technical Architecture

### Frontend (Next.js & React)
- **App Router:** Fully leveraged for layout structuring and clean URL mapping.
- **Tailwind CSS + Shadcn/UI:** Highly accessible, dark-mode native components with custom smooth animations (`animate-in`, `slide-in-from-bottom`).
- **Responsive Flexbox Layouts:** Eliminated common chat-app bugs (like page scrolling) by strictly enforcing `100dvh`, `overflow-hidden`, and flex `shrink-0` bounds. Touch-event listeners (`onTouchStart`, `onTouchMove`) handle mobile interactions seamlessly.

### Backend (Convex)
- **Real-Time Subscriptions:** Replaced traditional REST polling with Convex's WebSocket-based `useQuery` hooks for instant state propagation.
- **Optimistic UI:** Used structured Convex mutations for sub-50ms perceived latency on message sends and reactions.
- **Schema Validation:** Strictly typed `v.object()` schemas ensure bad data never enters the database.

### Authentication (Clerk)
- Integrated seamlessly with Next.js middleware to protect routes.
- Real-time `syncUser` mutation ensures that if a user updates their Clerk profile picture, it immediately reflects across all YapZone chats.

---

## 🚀 Local Installation

Want to run YapZone locally? Follow these steps:

**1. Clone the repository**
```bash
git clone [https://github.com/yourusername/yapzone.git](https://github.com/yourusername/yapzone.git)
cd yapzone
```

**2. Install dependencies**
```bash
npm install
```

**3. Setup Environment Variables**
Create a .env.local file in the root directory and add your Clerk and Convex keys:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_pub_key
CLERK_SECRET_KEY=your_clerk_secret_key

CONVEX_DEPLOYMENT=your_convex_deployment
NEXT_PUBLIC_CONVEX_URL=your_convex_url
```

**4. Start the Convex Backend**
```bash
npx convex dev
```

**5. Run the Next.js Development Server**
```bash
npm run dev
```
Open http://localhost:3000 to view the application.

---

<div align="center">
<p>Built with ☕ and hardwork... By: Yash Kumar</p>
</div>
