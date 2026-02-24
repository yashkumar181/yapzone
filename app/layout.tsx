// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { ThemeProvider } from "@/components/providers/theme-provider"; // NEW: Import ThemeProvider
import { Toaster } from "@/components/ui/sonner";

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
    // NEW: suppressHydrationWarning is strictly required for next-themes to work perfectly!
    <html lang="en" suppressHydrationWarning> 
      <body className={inter.className}>
        <ConvexClientProvider>
          {/* NEW: Wrap the app in the ThemeProvider */}
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </ConvexClientProvider>
        <Toaster position="top-center" richColors /> 
      </body>
    </html>
  );
}