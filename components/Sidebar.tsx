"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, BookOpen, GraduationCap, User, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { SPRING_POP } from "@/lib/motion";

// Shared mobile-drawer open state so the trigger (rendered in TopBar) and
// the drawer itself (rendered here) can agree without prop-drilling through
// layout.tsx. Wrap the shell in <SidebarProvider> once, at the layout root.
type SidebarCtx = { mobileOpen: boolean; setMobileOpen: (v: boolean) => void };
const SidebarContext = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  // Close the drawer on navigation — otherwise it stays open over the new
  // page since nothing else dismisses it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);
  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

const NAV_ITEMS = [
  { href: "/", label: "Modules", icon: BookOpen },
  { href: "/exam", label: "Exam Gate", icon: GraduationCap },
  { href: "/profile", label: "Profile", icon: User },
];

function computeInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar:collapsed") === "true";
}

function NavItems({ expanded, pathname, layoutIdPrefix }: { expanded: boolean; pathname: string; layoutIdPrefix: string }) {
  return (
    <nav className="flex-1 px-2 py-2 space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {active && (
              // The one shared-element "you are here" indicator — the only
              // new place the accent color carries meaning in the shell.
              <motion.span
                layoutId={`sidebar-active-indicator-${layoutIdPrefix}`}
                className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                transition={SPRING_POP}
              />
            )}
            <item.icon className="relative h-4 w-4 flex-shrink-0" />
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const [collapsed, setCollapsed] = useState(computeInitialCollapsed);

  // Matches the suppression Navbar.tsx used to apply during a live timed
  // exam — the sidebar collapses to icon-only and drops its nav items so
  // there's nothing tempting to click away to mid-exam.
  const isExamActive = pathname.includes("/exam/week/") && pathname.includes("/take");
  const effectiveCollapsed = isExamActive || collapsed;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar:collapsed", String(next));
      return next;
    });
  }, []);

  const brand = (expanded: boolean) => (
    <Link href="/" className="flex items-center gap-2 px-4 h-14 font-semibold text-foreground no-underline flex-shrink-0">
      <Terminal className="h-5 w-5 text-primary flex-shrink-0" />
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="whitespace-nowrap overflow-hidden"
          >
            42 Piscine
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );

  if (isExamActive) {
    return (
      <aside className="hidden lg:flex flex-col border-r bg-background flex-shrink-0 h-full w-16 items-center py-2">
        {brand(false)}
      </aside>
    );
  }

  return (
    <>
      {/* Desktop rail */}
      <motion.aside
        animate={{ width: effectiveCollapsed ? 64 : 240 }}
        transition={SPRING_POP}
        className="hidden lg:flex flex-col border-r bg-background flex-shrink-0 h-full overflow-hidden"
      >
        {brand(!effectiveCollapsed)}
        <NavItems expanded={!effectiveCollapsed} pathname={pathname} layoutIdPrefix="desktop" />
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 px-3 py-2.5 mx-2 mb-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4 flex-shrink-0" /> : <ChevronsLeft className="h-4 w-4 flex-shrink-0" />}
          {!collapsed && <span className="whitespace-nowrap">Collapse</span>}
        </button>
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={SPRING_POP}
              className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r bg-background lg:hidden"
            >
              <div className="flex items-center justify-between">
                {brand(true)}
                <button
                  onClick={() => setMobileOpen(false)}
                  className="mr-3 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavItems expanded={true} pathname={pathname} layoutIdPrefix="mobile" />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
