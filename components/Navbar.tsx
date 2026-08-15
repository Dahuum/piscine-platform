"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { BookOpen, Terminal, Sun, Moon, GraduationCap } from "lucide-react";
import AuthDialog from "./AuthDialog";
import { useState, useEffect } from "react";
import { getTheme, saveTheme } from "@/lib/db";

function computeInitialIsDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  return stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export default function Navbar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(computeInitialIsDark);
  const [online, setOnline] = useState(0);

  // DOM class syncs from isDark state (not the other way around) — this is
  // a pure side effect, no setState, so it's fine to run on every change.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Logged-in users' theme preference (lib/db.ts's saveTheme/getTheme,
  // backed by the user_settings table) previously existed but nothing
  // called it — only localStorage was ever read, so the preference never
  // followed a user across devices. Async, so setIsDark here doesn't
  // trigger the "setState synchronously in an effect" concern — it's not
  // synchronous.
  useEffect(() => {
    (async () => {
      try {
        const theme = await getTheme();
        if (theme) setIsDark(theme === "dark");
      } catch {
        // not logged in, or request failed — keep the localStorage value
      }
    })();
  }, []);

  useEffect(() => {
    let visitor = localStorage.getItem("visitor-id");
    if (!visitor) {
      visitor = Math.random().toString(36).slice(2, 10);
      localStorage.setItem("visitor-id", visitor);
    }
    const heartbeat = async () => {
      try {
        const res = await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor }),
        });
        const data = await res.json();
        setOnline(data.online);
      } catch { /* ignore */ }
    };
    heartbeat();
    const interval = setInterval(heartbeat, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next); // DOM class updates via the isDark effect above
    const theme = next ? "dark" : "light";
    localStorage.setItem("theme", theme);
    saveTheme(theme).catch(() => {});
  };

        const notHome = pathname !== "/";
  const isExamActive = pathname.includes("/exam/week/") && pathname.includes("/take");

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4 max-w-screen-2xl mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground no-underline">
          <Terminal className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">42 Piscine</span>
        </Link>

        <div className="flex items-center gap-1">
          {online > 0 && !isExamActive && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {online}
            </span>
          )}
          {notHome && !isExamActive && (
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Modules</span>
            </Link>
          )}
          {!isExamActive && (
            <Link href="/exam" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Exam Gate</span>
            </Link>
          )}
          <AuthDialog />
          <Button isIconOnly variant="ghost" size="sm" onPress={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
