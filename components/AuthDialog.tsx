"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Card } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";
import { User, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import MigrationModal from "./MigrationModal";
import { detectExistingData } from "@/lib/migrate-data";
import { hydrateFromCloud } from "@/lib/hydrate-data";

const inputClass = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50";

export default function AuthDialog() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showMigration, setShowMigration] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    let migrationShown = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (!migrationShown) {
          migrationShown = true;
          const { hasData } = detectExistingData();
          if (hasData) {
            setTimeout(() => setShowMigration(true), 600);
          } else {
            // No local data to offer importing (new device, or this browser
            // was already synced before) — pull down whatever's already
            // saved to the account instead, in case localStorage here is
            // empty but the account has progress from elsewhere. Guarded so
            // it runs once per tab per user, not on every auth event
            // (a persisted session re-fires this on every page load).
            const hydrateFlag = `hydrated:${session.user.id}`;
            if (!sessionStorage.getItem(hydrateFlag)) {
              sessionStorage.setItem(hydrateFlag, "1");
              hydrateFromCloud().then((wrote) => {
                if (wrote) window.location.reload();
              });
            }
          }
        }
      } else { setUser(null); migrationShown = false; }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error: authError } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    setOpen(false); setEmail(""); setPassword(""); setLoading(false);
  };

  const handleLogout = () => supabase.auth.signOut().then(() => setUser(null));

  if (!user) {
    return (
      <>
        <Button variant="ghost" size="sm" onPress={() => setOpen(true)} className="text-xs">
          <User className="h-3.5 w-3.5 mr-1" />
          <span className="hidden sm:inline">Sign In</span>
        </Button>
        {open && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <Card className="w-full max-w-sm mx-4 border shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <Card.Header className="flex flex-col gap-0.5">
                <Card.Title>{mode === "login" ? "Sign In" : "Create Account"}</Card.Title>
                <p className="text-xs text-muted-foreground">Sync your progress across devices.</p>
              </Card.Header>
              <Card.Content>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                  <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" variant="primary" className="w-full" isDisabled={loading}>
                    {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
                  </Button>
                </form>
              </Card.Content>
              <div className="px-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {mode === "login" ? "No account? " : "Already registered? "}
                  <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:underline font-medium">
                    {mode === "login" ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </div>
            </Card>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Link href="/profile" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline">
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{user.email?.split("@")[0]}</span>
        </Link>
        <Button variant="ghost" size="sm" onPress={handleLogout} className="text-xs">
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
      {showMigration && createPortal(
        <MigrationModal open={showMigration} onComplete={() => setShowMigration(false)} />,
        document.body
      )}
    </>
  );
}
