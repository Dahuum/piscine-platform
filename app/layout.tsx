import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar, { SidebarProvider } from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import AIChat from "@/components/AIChat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "42 Piscine Platform",
  description: "Master the 42 School C Piscine. Interactive lessons, live code editor, AI assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full">
        <SidebarProvider>
          <div className="flex h-full">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </div>
        </SidebarProvider>
        <AIChat />
      </body>
    </html>
  );
}
