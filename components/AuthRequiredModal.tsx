"use client";

import { useState } from "react";
import { Button, Card } from "@heroui/react";
import { User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputClass = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50";

export default function AuthRequiredModal({
  open, onClose,
  message = "Sign in to save your progress and access all features.",
}: { open: boolean; onClose: () => void; message?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error: authError } = mode === "login"
      ? await createClient().auth.signInWithPassword({ email, password })
      : await createClient().auth.signUp({ email, password });
    if (authError) { setError(authError.message); setLoading(false); }
    else window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-sm mx-4 border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Card.Header className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <Card.Title>{mode === "login" ? "Sign In" : "Create Account"}</Card.Title>
              <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0 mt-1">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
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
    </div>
  );
}
