"use client";

import { useState, useEffect } from "react";
import { Button, Card } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";
import { User, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import MigrationModal from "./MigrationModal";
import { detectExistingData } from "@/lib/migrate-data";

const inputClass = "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50";

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
          if (hasData) setTimeout(() => setShowMigration(true), 600);
        }
      } else {
        setUser(null);
        migrationShown = false;
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const authFn = mode === "login"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error: authError } = await authFn;
    if (authError) { setError(authError.message); setLoading(false); return; }
    setOpen(false);
    setEmail("");
    setPassword("");
    setLoading(false);
  };

  if (!user) {
    return (
      <>
        <Button variant="ghost" size="sm" onPress={() => setOpen(true)} className="text-xs">
          <User className="h-3.5 w-3.5 mr-1" />
          <span className="hidden sm:inline">Sign In</span>
        </Button>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
            <Card className="w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">{mode === "login" ? "Sign In" : "Create Account"}</h2>
              <p className="text-xs text-muted-foreground mb-4">Sync your progress across devices.</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <Button type="submit" variant="primary" className="w-full" isDisabled={loading}>
                  {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-3">
                {mode === "login" ? "No account? " : "Already registered? "}
                <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:underline font-medium">
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </Card>
          </div>
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
      <MigrationModal open={showMigration} onComplete={() => setShowMigration(false)} />
    </>
  );

  function handleLogout() { supabase.auth.signOut().then(() => setUser(null)); }
}
