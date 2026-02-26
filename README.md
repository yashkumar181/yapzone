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

### 📱 Feature Showcase

| Real-Time Read Receipts | Inline Message Editing |
| :---: | :---: |
| <img src="link-to-read-receipts.gif" width="100%"> | <img src="link-to-editing.gif" width="100%"> |

| Admin Role & Group Management | In-Chat Full Text Search |
| :---: | :---: |
| <img src="link-to-group-admin.png" width="100%"> | <img src="link-to-search.png" width="100%"> |
---

## ✨ Standout Features

YapZone was built with an obsessive focus on edge cases, mobile UX, and database security. It delivers a comprehensive suite of features expected from enterprise-level messaging platforms.

### 🛡️ Advanced Privacy & Organization
- **In-Chat Message Search:** A dedicated search bar within individual chats that queries the database via `.searchIndex()` and dynamically scrolls to and highlights the searched messages in the chat feed.
- **Mutual Blocking Engine:** Robust backend security utilizing conditional UI rendering. If a user is blocked, the input field is removed, replaced with a clear status message, and API requests are unauthorized.
- **Chat Pinning:** Users can pin important 1-on-1s or Group Chats to the very top of their sidebar using either a right-click/long-press context menu or the User Info drawer.
- **Sidebar Context Menus:** Desktop right-click and mobile long-press functionality to instantly Pin, Block, or Delete chats without entering them.

### 💬 Rich Messaging Experience
- **Rich Media Support:** Capability to upload, send, and preview images directly within chat bubbles using Convex storage and client-side resizing logic.
- **Message Editing:** Inline editing capability where users can update sent messages, dynamically updating the database and displaying an `(edited)` tag.
- **Message Deletion:** Support for "soft deleting" messages, replacing the content with an italicized *"This message was deleted"* notice for all participants.
- **Dynamic Reactions:** A mathematically positioned emoji tooltip allows users to react to messages, displaying real-time reaction counts below the bubble.
- **Smart Replies:** Support for swiping on a message (mobile) or clicking to reply, with a UI that links the reply back to the original message for context.

### ⚡ Intelligent UI & Interaction
- **Granular Read Receipts:** Visual indicators tracking exact `lastReadAt` timestamps—showing a single grey tick for sent messages and double blue ticks when the recipient has viewed them.
- **Real-Time Typing Indicators:** Dynamic alerts showing exactly who is typing (e.g., *"Alex and Sam are typing..."*) managed via Convex time-expiring documents.
- **Global User Discovery:** A dedicated "People on YapZone" modal accessible via a top-bar icon to instantly find and initiate chats with any registered user.
- **Smart Auto-Scroll & Unread Badges:** Glowing blue badges in the sidebar show unread counts, clearing automatically upon opening. The chat feed auto-scrolls for new messages, offering a floating "New messages" button if scrolled up.
- **Theme Toggle:** Full support for switching between Light and Dark modes.

### 👥 Comprehensive Group Management
- **Group Creation:** Users can instantly create multi-member group conversations with custom names.
- **Admin Controls:** Group admins have exclusive authority to add new members from the platform or kick existing members from the group.
- **Custom Group Profiles:** Admins can set group descriptions and upload custom avatars from their local device to personalize the group space.
- **Leave/Delete Logic:** Members can gracefully exit a group while keeping their historical read view, or completely scrub the group record from their interface.
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
