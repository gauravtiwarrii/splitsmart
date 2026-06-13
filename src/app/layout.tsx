import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "next-auth/react";
import { AIAssistant } from "@/components/chat/ai-assistant";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SplitSmart — Split Expenses, Not Friendships",
  description:
    "A premium shared expenses app for managing group expenses, settlements, and CSV imports with anomaly detection.",
  keywords: ["expenses", "split", "group", "fintech", "settlements"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            {children}
            <AIAssistant />
            <Toaster />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
