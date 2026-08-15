"use client";

import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Menu } from "lucide-react";
import AuthDialog from "./AuthDialog";
import { useSidebar } from "./Sidebar";
import { useState, useEffect } from "react";
import { getTheme, saveTheme } from "@/lib/db";

function computeInitialIsDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  return stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

// The slim persistent 3.5rem strip to the right of Sidebar.tsx — deliberately
// kept at the same height the old Navbar.tsx used, since three full-bleed
// editor pages hardcode h-[calc(100vh-3.5rem)] and changing this height
// would silently break their layout math.
export default function TopBar() {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebar();
  // Starts at the same false the server always renders (computeInitialIsDark
  // returns false when window is undefined) rather than reading localStorage
  // in the useState initializer — that ran on the client's first render too,
  // before hydration reconciled, so a returning dark-mode user's toggle
  // button/icon differed between server and client (confirmed via a real
  // hydration-mismatch diff). Corrected below in an effect instead, matching
  // the pattern already used for computeProgress() on the home page.
  const [isDark, setIsDark] = useState(false);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(computeInitialIsDark());
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

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
    setIsDark(next);
    const theme = next ? "dark" : "light";
    localStorage.setItem("theme", theme);
    saveTheme(theme).catch(() => {});
  };

  const isExamActive = pathname.includes("/exam/week/") && pathname.includes("/take");

  return (
    <header className="sticky top-0 z-30 h-14 flex-shrink-0 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {!isExamActive && (
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>

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
          <AuthDialog />
          <Button isIconOnly variant="ghost" size="sm" onPress={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} className="overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? "sun" : "moon"}
                initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ duration: 0.15 }}
                className="inline-flex"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </header>
  );
}
