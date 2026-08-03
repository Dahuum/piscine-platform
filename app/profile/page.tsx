"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { motion } from "framer-motion";
import {
  Trophy, Clock, Target, BookOpen, GraduationCap,
  LogIn, User, Activity, BarChart3,
} from "lucide-react";
import { getUserStats, getUserEmail, type UserStats } from "@/lib/user-stats";
import { examWeeks as examWeeksData } from "@/lib/exam-data";

const inputClass = "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50";

export default function ProfilePage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    (async () => {
      const e = await getUserEmail();
      if (!e) { setLoading(false); return; }
      setEmail(e);
      setStats(await getUserStats());
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="max-w-screen-xl mx-auto px-4 py-16 text-center"><p className="text-sm text-muted-foreground">Loading your profile...</p></div>;

  if (!email) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Your Profile</h1>
        <p className="text-sm text-muted-foreground mb-6">Sign in to track your progress, save exam results, and sync across devices.</p>
        <Button variant="primary" onPress={() => setShowAuth(true)}>
          <LogIn className="h-4 w-4 mr-1.5" /> Sign In
        </Button>
        {showAuth && <ProfileAuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const s = stats;
  const noData = !s || (s.totalExercises === 0 && s.totalExams === 0);

  return (
    <motion.div className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
      <motion.div className="mb-8" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{email.split("@")[0]}</h1>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
      </motion.div>

      {noData ? (
        <div className="text-center py-12 border rounded-xl">
          <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No data yet. Start practicing or take an exam!</p>
          <div className="flex justify-center gap-3 mt-4">
            <Link href="/"><Button variant="primary" size="sm">Start Learning</Button></Link>
            <Link href="/exam"><Button variant="outline" size="sm">Exam Gate</Button></Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { icon: Target, label: "Exercises", value: String(s!.totalExercises) },
              { icon: BookOpen, label: "Modules", value: `${s!.modulesCompleted}/13` },
              { icon: GraduationCap, label: "Exams", value: String(s!.totalExams) },
              { icon: Trophy, label: "Best", value: `${s!.bestExamGrade}%` },
              { icon: Clock, label: "Hours", value: `${s!.totalHours}h` },
              { icon: BarChart3, label: "Pass Rate", value: `${s!.passRate}%` },
            ].map((st, i) => (
              <motion.div key={st.label} className="rounded-xl border bg-muted/20 p-3 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <st.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <div className="text-lg font-bold tabular-nums">{st.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{st.label}</div>
              </motion.div>
            ))}
          </div>

          {s!.recentExams.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold mb-3">Recent Exams</h2>
              <div className="space-y-2">
                {s!.recentExams.map((exam) => {
                  const weekName = examWeeksData[exam.weekId]?.title || exam.weekId;
                  return (
                    <div key={exam.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm">
                      <Trophy className={`h-4 w-4 ${exam.result === "completed" ? "text-emerald-500" : "text-amber-500"}`} />
                      <span className="font-medium min-w-0 truncate">{weekName}</span>
                      <div className="flex-1" />
                      <span className="font-bold tabular-nums">{exam.grade}/100</span>
                      <span className="text-xs text-muted-foreground">{new Date(exam.date).toLocaleDateString()}</span>
                      <span className={`text-[10px] uppercase font-medium ${exam.result === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{exam.result}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {s!.examWeeks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3">By Exam Week</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {s!.examWeeks.map((ew) => {
                  const weekName = examWeeksData[ew.weekId]?.title || ew.weekId;
                  return (
                    <div key={ew.weekId} className="rounded-lg border p-3">
                      <div className="text-sm font-medium">{weekName}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{ew.attempts} attempts</span><span>Best: {ew.best}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function ProfileAuthModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: authError } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (authError) { setError(authError.message); setLoading(false); }
    else window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <Card className="w-full max-w-sm mx-4 border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Card.Header className="flex flex-col gap-0.5">
          <Card.Title>{mode === "login" ? "Sign In" : "Create Account"}</Card.Title>
          <p className="text-xs text-muted-foreground">Save your progress across devices.</p>
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
