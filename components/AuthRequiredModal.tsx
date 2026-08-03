"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthRequiredModal({
  open,
  onClose,
  message = "Sign in to save your progress and access all features.",
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-background rounded-xl border shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{mode === "login" ? "Sign In" : "Create Account"}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">{message}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border bg-muted/30 text-sm outline-none focus:border-primary transition-colors" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="w-full px-3 py-2 rounded-lg border bg-muted/30 text-sm outline-none focus:border-primary transition-colors" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" variant="primary" size="sm" className="w-full" isDisabled={loading}>
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-3">
          {mode === "login" ? "No account? " : "Already have one? "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:underline">
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
