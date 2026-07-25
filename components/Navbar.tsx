"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { BookOpen, Terminal, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "light" : "dark");
  };

  const notHome = pathname !== "/";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4 max-w-screen-2xl mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground no-underline">
          <Terminal className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">42 Piscine</span>
        </Link>

        <div className="flex items-center gap-1">
          {notHome && (
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Modules</span>
            </Link>
          )}
          <Button isIconOnly variant="ghost" size="sm" onPress={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
