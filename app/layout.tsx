// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YapZone",
  description: "Real-time communication platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}