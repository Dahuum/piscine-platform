"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Card } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";
import { User, LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import MigrationModal from "./MigrationModal";
import { detectExistingData } from "@/lib/migrate-data";
import { hydrateFromCloud } from "@/lib/hydrate-data";
import { setCachedUserId } from "@/lib/db";

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
  const [confirmSent, setConfirmSent] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    let migrationShown = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        // lib/db.ts keeps its own independent onAuthStateChange subscription
        // to cache the user id for every DB read/write in the app, with no
        // ordering guarantee relative to this one. If hydrateFromCloud()
        // below runs before that other subscription gets around to updating
        // its cache, every query it makes silently sees a stale null user id
        // and comes back empty — hydration would then do nothing at all,
        // with no error, even though the user is genuinely logged in. Seed
        // it directly with the id this handler already has, so hydration
        // never has to depend on that race resolving in the right order.
        setCachedUserId(session.user.id);
        if (!migrationShown) {
          migrationShown = true;
          const userId = session.user.id;
          const hydrateFlag = `hydrated:${userId}`;
          const migrationPendingFlag = `migration-pending:${userId}`;

          if (sessionStorage.getItem(migrationPendingFlag)) {
            // Hydration on the previous load found local-only data worth
            // offering to push up, but it also had to reload the page to
            // surface what it pulled down — which would have discarded the
            // modal before it ever appeared. Show it now instead.
            sessionStorage.removeItem(migrationPendingFlag);
            setTimeout(() => setShowMigration(true), 600);
          } else if (!sessionStorage.getItem(hydrateFlag)) {
            // Always pull down whatever's already saved to the account,
            // regardless of whether this device also has local-only data —
            // those aren't mutually exclusive. Having typed even one
            // character into an editor before logging in is enough to make
            // detectExistingData() report "has local data", and that used
            // to skip hydration entirely: a real account with real history
            // from another device would show nothing here because the
            // (one-way, local -> cloud only) migration prompt ran instead
            // of ever pulling the cloud data down. Guarded so it runs once
            // per tab per user, not on every auth event (a persisted
            // session re-fires this on every page load).
            sessionStorage.setItem(hydrateFlag, "1");
            // Snapshot before hydration writes anything, so newly
            // hydrated-in keys aren't miscounted as "local progress" worth
            // re-uploading a moment later.
            const { hasData } = detectExistingData(userId);
            hydrateFromCloud().then((wrote) => {
              if (wrote) {
                if (hasData) sessionStorage.setItem(migrationPendingFlag, "1");
                window.location.reload();
              } else if (hasData) {
                setTimeout(() => setShowMigration(true), 600);
              }
            });
          } else {
            const { hasData } = detectExistingData(userId);
            if (hasData) setTimeout(() => setShowMigration(true), 600);
          }
        }
      } else {
        setUser(null);
        migrationShown = false;
        setCachedUserId(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); setLoading(false); return; }
      setOpen(false); setEmail(""); setPassword(""); setLoading(false);
      return;
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (authError) { setError(authError.message); setLoading(false); return; }
    setLoading(false);
    // A user comes back with no session when email confirmation is required
    // (mailer_autoconfirm is off for this project) — the account isn't
    // usable yet until they click the link, so tell them that instead of
    // silently closing the dialog like nothing happened.
    if (data.user && !data.session) {
      setConfirmSent(true);
      return;
    }
    setOpen(false); setEmail(""); setPassword("");
  };

  const resetDialog = () => {
    setOpen(false); setEmail(""); setPassword(""); setError(""); setConfirmSent(false); setMode("login");
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
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetDialog}>
            <Card className="w-full max-w-sm mx-4 border shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {confirmSent ? (
                <>
                  <Card.Header className="flex flex-col gap-0.5">
                    <Card.Title>Check your email</Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <p className="text-sm text-muted-foreground">
                      We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
                      Click it to activate your account — you&apos;ll be brought back here signed in.
                    </p>
                  </Card.Content>
                  <div className="px-4 pb-4">
                    <Button variant="ghost" className="w-full" onPress={resetDialog}>Got it</Button>
                  </div>
                </>
              ) : (
                <>
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
                      <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} className="text-primary hover:underline font-medium">
                        {mode === "login" ? "Sign up" : "Sign in"}
                      </button>
                    </p>
                  </div>
                </>
              )}
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
        <MigrationModal open={showMigration} userId={user.id} onComplete={() => setShowMigration(false)} />,
        document.body
      )}
    </>
  );
}
