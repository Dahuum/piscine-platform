"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  RotateCcw,
  ChevronLeft,
  Monitor,
  Terminal,
  Clock,
  Trophy,
  CheckCircle2,
} from "lucide-react";
import { getExamWeekOrNull, lockedWeeks, getExercise } from "@/lib/exam-data";
import type { ExamExercise } from "@/lib/exam-data";
import { saveExamAttempt } from "@/lib/db";
import CodeEditor from "@/components/CodeEditor";
import dynamic from "next/dynamic";

const ExamTerminal = dynamic(() => import("@/components/ExamTerminal"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e]">
      <p className="text-sm text-muted-foreground">Loading terminal...</p>
    </div>
  ),
});

type Stage = "select" | "confirm" | "active" | "results";

export default function ExamTakePage() {
  const params = useParams<{ id: string }>();
  const weekId = params.id;

  if (lockedWeeks[weekId as keyof typeof lockedWeeks]) notFound();

  const week = getExamWeekOrNull(weekId);
  if (!week) notFound();

  return <ExamInner weekId={weekId} />;
}

function SubjectText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("$>")) {
      const codeLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("$>")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre
          key={`code-${i}`}
          className="my-2 p-2.5 rounded-md bg-muted font-mono text-xs text-foreground/80 overflow-x-auto whitespace-pre-wrap"
        >
          {codeLines.join("\n")}
        </pre>,
      );
    } else if (line.trim() === "") {
      if (
        elements.length > 0 &&
        typeof elements[elements.length - 1] !== "string"
      ) {
        elements.push(
          <div key={`spacer-${i}`} className="h-2" />,
        );
      }
      i++;
    } else {
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].trim().startsWith("$>")
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      elements.push(
        <p key={`p-${i}`} className="whitespace-pre-wrap">
          {paraLines.join("\n")}
        </p>,
      );
    }
  }

  return <>{elements}</>;
}

function ExamInner({ weekId }: { weekId: string }) {
  const router = useRouter();
  const week = getExamWeekOrNull(weekId)!;
  const [stage, setStage] = useState<Stage>("select");
  const [mode, setMode] = useState<"editor" | "terminal">("editor");
  const [token, setToken] = useState<string | null>(null);
  const [exercise, setExercise] = useState<{
    name: string;
    level: number;
    type: string;
    subject: ExamExercise["subject"];
  } | null>(null);
  const [code, setCode] = useState("");
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState<{
    passed?: boolean;
    traceback?: string;
    compilationError?: string;
  } | null>(null);
  const [cooldown, setCooldown] = useState<{
    until: number;
    remaining: number;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(week.timeMinutes * 60);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentGrade, setCurrentGrade] = useState(0);
  const [levelHistory, setLevelHistory] = useState<
    { level: number; exercise: string; passed: boolean; attempts: number }[]
  >([]);
  const [status, setStatus] = useState<string>("active");
  const [examComplete, setExamComplete] = useState(false);
  const [showNewLevel, setShowNewLevel] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const [terminalSandbox, setTerminalSandbox] = useState<{
    sandboxId: string;
    pid: number;
  } | null>(null);

  const tokenKey = `exam:token:${weekId}`;

  const getVisitorId = () =>
    typeof window !== "undefined"
      ? localStorage.getItem("visitor-id") ||
        Math.random().toString(36).slice(2, 10)
      : Math.random().toString(36).slice(2, 10);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !localStorage.getItem("visitor-id")
    ) {
      localStorage.setItem("visitor-id", Math.random().toString(36).slice(2, 10));
    }
  }, []);

  // On mount, check for a saved token from a previous tab session (e.g. a
  // refresh) and try to reconnect to its still-active server-side session
  // instead of defaulting to "select" — the server session keeps running
  // its own clock/cooldown regardless of what the client remembers, so a
  // lost/reset client previously meant losing progress and, worse, getting
  // a free cooldown reset by just starting over.
  //
  // `resuming` starts false (matching the server, which never has access
  // to sessionStorage) rather than reading sessionStorage directly in a
  // useState initializer — that would render "resuming" on the client but
  // "select" on the server for anyone with a saved token, which is exactly
  // the kind of server/client branch that trips a hydration mismatch
  // (confirmed via a real render diff during testing). Flipping it here,
  // post-mount, means a resuming user briefly sees "select" render once
  // before the spinner takes over instead — much cheaper than a mismatch.
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? sessionStorage.getItem(tokenKey) : null;
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResuming(true);
    fetch(`/api/exam/status?token=${encodeURIComponent(saved)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) {
          sessionStorage.removeItem(tokenKey);
          return;
        }
        if (data.status !== "active") {
          sessionStorage.removeItem(tokenKey);
          if (data.status === "completed" || data.status === "timeout") {
            router.replace(`/exam/week/${weekId}/results`);
          }
          return;
        }
        const resolvedExercise = getExercise(
          weekId,
          data.currentLevel,
          data.currentExercise,
        );
        setToken(saved);
        setCurrentLevel(data.currentLevel);
        setCurrentGrade(data.grade);
        setLevelHistory(data.levelHistory || []);
        setTimeRemaining(Math.round(data.timeRemaining));
        if (data.cooldownUntil > Date.now()) {
          setCooldown({
            until: data.cooldownUntil,
            remaining: Math.ceil((data.cooldownUntil - Date.now()) / 1000),
          });
        }
        if (resolvedExercise) {
          setExercise({
            name: resolvedExercise.name,
            level: resolvedExercise.level,
            type: resolvedExercise.type,
            subject: resolvedExercise.subject,
          });
        }
        setStatus("active");
        setStage("active");
      })
      .catch(() => sessionStorage.removeItem(tokenKey))
      .finally(() => setResuming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startExam = async (selectedMode: "editor" | "terminal") => {
    if (starting) return;
    setStarting(true);
    try {
      const body: Record<string, unknown> = {
        weekId,
        mode: selectedMode,
        visitorId: getVisitorId(),
      };
      if (selectedMode === "terminal" && terminalSandbox?.sandboxId) {
        body.sandboxId = terminalSandbox.sandboxId;
      }

      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start exam");
      }
      const data = await res.json();
      setToken(data.token);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(tokenKey, data.token);
      }
      setExercise(data.exercise);
      setCode("");
      setCurrentLevel(data.currentLevel ?? 0);
      setCurrentGrade(data.currentGrade ?? 0);
      setLevelHistory(data.levelHistory || []);
      setFeedback(null);
      setCooldown(
        data.cooldownUntil && data.cooldownUntil > Date.now()
          ? {
              until: data.cooldownUntil,
              remaining: Math.ceil((data.cooldownUntil - Date.now()) / 1000),
            }
          : null,
      );
      setStage("active");
      setStatus("active");
      setExamComplete(false);
      setShowNewLevel(false);
      setTimeRemaining(
        data.resumed ? Math.round(data.timeRemaining) : data.timeLimitSeconds,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start";
      alert(msg);
    } finally {
      setStarting(false);
    }
  };

  const timerTick = useCallback(() => {
    setTimeRemaining((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setStatus("timeout");
        return 0;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (stage === "active") {
      timerRef.current = setInterval(timerTick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [stage, timerTick]);

  const saveToHistory = (data: {
    grade?: number;
    levelHistory?: typeof levelHistory;
  }) => {
    try {
      const raw = localStorage.getItem("exam:history");
      const history = raw ? JSON.parse(raw) : [];
      history.unshift({
        id: Math.random().toString(36).slice(2, 10),
        weekId,
        mode,
        startedAt:
          Date.now() - (week.timeMinutes * 60 - timeRemaining) * 1000,
        endedAt: Date.now(),
        duration: week.timeMinutes * 60 - timeRemaining,
        result: status === "timeout" ? "timeout" : "completed",
        finalGrade: data.grade ?? currentGrade,
        levels: data.levelHistory || levelHistory,
      });
      localStorage.setItem("exam:history", JSON.stringify(history));
      saveExamAttempt(history[0]).catch(() => {});
    } catch {
      // ignore
    }
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (status === "timeout" && token) {
      if (typeof window !== "undefined") sessionStorage.removeItem(tokenKey);
      fetch("/api/exam/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: "timeout" }),
      })
        .then((r) => r.json())
        .then((d) => {
          saveToHistory(d);
        })
        .catch(() => {
          // best-effort — the timeout banner + local history entry already
          // reflect the outcome even if the server-side save failed
          saveToHistory({});
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  useEffect(() => {
    if (cooldown && cooldown.remaining > 0) {
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (!prev) return null;
          const remaining = Math.max(
            0,
            Math.ceil((prev.until - Date.now()) / 1000),
          );
          if (remaining <= 0) return null;
          return { ...prev, remaining };
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [cooldown]);

  const handleTerminalSubmit = async () => {
    if (!token || grading) return;
    setGrading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/exam/grade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, studentCode: "" }),
      });
      await processGradeResponse(res);
    } catch {
      setFeedback({ passed: false, traceback: "Network error" });
    }
    setGrading(false);
  };

  const processGradeResponse = async (res: Response) => {
    const data = await res.json();

    if (res.status === 429) {
      setCooldown({
        until: Date.now() + data.cooldownRemaining,
        remaining: Math.ceil(data.cooldownRemaining / 1000),
      });
      return;
    }

    if (data.systemError) {
      // Our fault (grading infra), not the student's — no cooldown was
      // applied server-side either, so just surface it and let them retry.
      setFeedback({
        passed: false,
        traceback: data.error,
        compilationError: data.compilationError,
      });
      return;
    }

    if (data.exercise) {
      // Server moved us to a different exercise (the previous one no
      // longer resolved) — reflect that instead of continuing to show a
      // stale prompt the next submission won't actually be graded against.
      setExercise(data.exercise);
      setCode("");
      setFeedback({
        passed: false,
        traceback: "That exercise changed — you've been given a new one, please try again.",
      });
      return;
    }

    if (data.error) {
      if (data.status === "timeout") {
        setStatus("timeout");
        return;
      }
      setFeedback({ passed: false, traceback: data.error });
      return;
    }

    if (data.passed) {
      if (data.examComplete) {
        setExamComplete(true);
        setCurrentGrade(data.finalGrade || 100);
        setLevelHistory(data.levelHistory || []);
        setStatus("completed");
        if (typeof window !== "undefined") sessionStorage.removeItem(tokenKey);
        saveToHistory({ grade: data.finalGrade, levelHistory: data.levelHistory });
        fetch("/api/exam/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, reason: "completed" }),
        }).catch(() => {});
        return;
      }
      setFeedback({ passed: true });
      setShowNewLevel(true);
      setCurrentGrade(data.grade);
      setLevelHistory(data.levelHistory);
      setCooldown(null);
      setTimeout(() => {
        setCurrentLevel(data.newLevel);
        if (data.newExercise) setExercise(data.newExercise);
        setCode("");
        setFeedback(null);
        setShowNewLevel(false);
      }, 1800);
    } else {
      setFeedback({ passed: false, traceback: data.traceback, compilationError: data.compilationError });
      if (data.cooldownSeconds > 0) {
        setCooldown({ until: Date.now() + data.cooldownSeconds * 1000, remaining: data.cooldownSeconds });
      }
    }
  };

  const handleSubmit = async () => {
    if (!code.trim() || !token || grading) return;
    setGrading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/exam/grade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, studentCode: code }),
      });
      await processGradeResponse(res);
    } catch {
      setFeedback({ passed: false, traceback: "Network error" });
    }
    setGrading(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        stage === "active"
      ) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, code, token, grading]);

  const finishExam = async () => {
    if (typeof window !== "undefined") sessionStorage.removeItem(tokenKey);
    if (token) {
      try {
        await fetch("/api/exam/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, reason: "abandoned" }),
        });
      } catch {
        // best-effort — still navigate away even if this failed, otherwise
        // a network hiccup leaves the user stuck on the exam screen
      }
    }
    router.push(`/exam/week/${weekId}/results`);
  };

  // Avoid flashing the "select" screen (with its own "Begin Exam" button)
  // for the instant it takes to check whether a saved token can resume an
  // already-active session — that flash previously made it easy to
  // accidentally start a second session before the resume check landed.
  if (resuming) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <RotateCcw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (examComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
        className="max-w-lg mx-auto px-4 py-16 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.08, type: "spring", stiffness: 200 }}
        >
          <Trophy className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
        </motion.div>
        <motion.h1
          className="text-2xl font-bold mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.06 }}
        >
          Exam Complete!
        </motion.h1>
        <motion.p
          className="text-muted-foreground mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.07 }}
        >
          {status === "timeout" ? "Time ran out" : "All levels completed"}
        </motion.p>
        <motion.div
          className="text-5xl font-bold tabular-nums mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          {currentGrade}/100
        </motion.div>
        <motion.p
          className="text-sm text-muted-foreground mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.09 }}
        >
          {levelHistory.filter((h) => h.passed).length} of {week.levelCount}{" "}
          levels passed
        </motion.p>
        <motion.div
          className="flex justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Button
            variant="primary"
            onPress={() =>
              router.push(`/exam/week/${weekId}/results`)
            }
          >
            View Results
          </Button>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retake
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  if (stage === "select") {
    return (
      <motion.div
        className="max-w-lg mx-auto px-4 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
      >
        <Link
          href="/exam"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline mb-6 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Exam Gate
        </Link>

        <h1 className="text-2xl font-bold mb-2">{week.title} — Real Exam</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {week.description}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Clock, label: "240 min", desc: "4 hours" },
            { icon: null, label: `${week.levelCount} levels`, desc: `0 → ${week.levelCount - 1}` },
            { icon: null, label: `${week.gradePerLevel} pts`, desc: "per level" },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="rounded-lg border p-3 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {item.icon && <item.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />}
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="text-[10px] text-muted-foreground">{item.desc}</div>
            </motion.div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground space-y-1.5 mb-8 border rounded-lg p-4">
          <p className="font-medium text-foreground text-sm mb-2">Rules:</p>
          <p>· No AI assistance during the exam</p>
          <p>· Random exercise drawn per level</p>
          <p>· Cooldown increases on repeated failures</p>
          <p>· Exam ends when all levels complete or time runs out</p>
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Choose mode
        </p>
        <div className="grid grid-cols-2 gap-3 mb-2">
          {[
            { mode: "editor" as const, icon: Monitor, title: "Editor", desc: "Monaco editor + Run button", available: true },
            { mode: "terminal" as const, icon: Terminal, title: "Terminal", desc: "Real shell via xterm.js", available: false },
          ].map((item) => (
            <motion.button
              key={item.mode}
              onClick={() => item.available && setMode(item.mode)}
              disabled={!item.available}
              className={`rounded-lg border p-4 text-left transition-all duration-200 ${
                !item.available
                  ? "opacity-50 cursor-not-allowed"
                  : mode === item.mode
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                    : "hover:border-border hover:bg-muted/50"
              }`}
              whileTap={item.available ? { scale: 0.97 } : undefined}
            >
              <item.icon className={`h-5 w-5 mb-2 ${mode === item.mode && item.available ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {item.available ? item.desc : "Temporarily unavailable"}
              </div>
            </motion.button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70 mb-6">
          Terminal mode needs an always-on server we haven&apos;t set up yet — use Editor mode for now, it grades the same way.
        </p>

        <Button
          variant="primary"
          size="lg"
          onPress={() => setStage("confirm")}
          className="w-full"
        >
          Continue with Editor
        </Button>
      </motion.div>
    );
  }

  if (stage === "confirm") {
    return (
      <motion.div
        className="max-w-lg mx-auto px-4 py-12 text-center"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.1 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.05 }}
        >
          <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        </motion.div>
        <h1 className="text-xl font-bold mb-2">Ready to begin?</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {week.title} · {mode === "editor" ? "Editor" : "Terminal"} mode
          <br />
          Timer starts when you press Begin.
          <br />
          240 minutes · Cannot be paused.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onPress={() => setStage("select")} isDisabled={starting}>
            Back
          </Button>
          <Button variant="primary" onPress={() => startExam(mode)} isDisabled={starting}>
            {starting ? "Starting..." : "Begin Exam"}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <motion.div
        className="border-b px-2 sm:px-4 flex items-center gap-1.5 sm:gap-4 flex-shrink-0 bg-background overflow-hidden"
        style={{ height: 44 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span
          className={`text-sm font-sans font-bold tabular-nums flex-shrink-0 ${
            timeRemaining < 1800 ? "text-red-500" : "text-foreground"
          }`}
        >
          {formatTime(timeRemaining)}
        </span>
        <span className="text-muted-foreground/40 text-xs hidden sm:inline flex-shrink-0">·</span>
        <span className="text-sm tabular-nums font-medium flex-shrink-0">
          <span className="hidden sm:inline">Level </span>
          {currentLevel}/{week.levelCount}
        </span>
        <span className="text-muted-foreground/40 text-xs hidden sm:inline flex-shrink-0">·</span>
        <span className="text-sm tabular-nums font-medium flex-shrink-0">
          <span className="hidden sm:inline">Grade </span>
          {currentGrade}/100
        </span>
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: week.levelCount }, (_, i) => {
            const historyEntry = levelHistory.find((h) => h.level === i);
            const isPassed = historyEntry?.passed;
            const isCurrent =
              i === currentLevel && !(status === "timeout");
            const isFailed = historyEntry && !historyEntry.passed;
            return (
              <motion.div
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  isPassed
                    ? "bg-emerald-500"
                    : isCurrent
                      ? "bg-primary ring-2 ring-primary/30"
                      : isFailed
                        ? "bg-red-500/50"
                        : "bg-muted"
                }`}
                title={`Level ${i}${
                  historyEntry
                    ? `: ${historyEntry.exercise} (${historyEntry.passed ? "passed" : "failed"})`
                    : ""
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.02, type: "spring", stiffness: 300 }}
              />
            );
          })}
        </div>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={finishExam}
          className="ml-2"
          aria-label="Finish exam"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </motion.div>

      {status === "timeout" && (
        <motion.div
          className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-600 font-medium"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
        >
          Time expired. Exam ended.
        </motion.div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {exercise && (
            <motion.div
              key={`${exercise.level}-${exercise.name}`}
              className="border-b px-5 py-4 bg-muted/20 flex-shrink-0 max-h-[35%] overflow-y-auto scrollbar-thin"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.1 }}
            >
              <h2 className="text-base font-semibold mb-2">
                {exercise.name}
              </h2>
              <div className="text-sm text-muted-foreground leading-relaxed">
                <SubjectText text={exercise.subject.description} />
              </div>
              {(exercise.subject.files.length > 0 ||
                exercise.subject.allowed.length > 0) && (
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  {exercise.subject.files.length > 0 && (
                    <span>
                      Turn-in:{" "}
                      <code className="text-foreground/80 font-mono">
                        {exercise.subject.files.join(", ")}
                      </code>
                    </span>
                  )}
                  {exercise.subject.allowed.length > 0 && (
                    <span>
                      Allowed:{" "}
                      <code className="text-foreground/80 font-mono">
                        {exercise.subject.allowed.join(", ")}
                      </code>
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {mode === "terminal" ? (
          <div className="flex-1 relative bg-[#1e1e1e] min-h-[150px]">
            <ExamTerminal
              onReady={(sandboxId, pid) => {
                setTerminalSandbox({ sandboxId, pid });
              }}
            />
          </div>
        ) : (
          <div className="flex-1 relative bg-white dark:bg-[#1e1e1e] min-h-[150px]">
            <CodeEditor
              value={code}
              onChange={(v) => setCode(v || "")}
              language="c"
            />
          </div>
        )}

        {/* Submit bar */}
        <div className="border-t px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 flex-shrink-0 bg-muted/20 overflow-hidden">
          <Button
            variant="primary"
            size="sm"
            onPress={
              mode === "terminal"
                ? () => handleTerminalSubmit()
                : handleSubmit
            }
            isDisabled={
              mode === "terminal"
                ? !terminalSandbox ||
                  grading ||
                  cooldown !== null ||
                  status !== "active"
                : grading ||
                  !code.trim() ||
                  cooldown !== null ||
                  status !== "active"
            }
          >
            {grading ? (
              <motion.span
                className="flex items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Grading...
              </motion.span>
            ) : (
              <motion.span
                className="flex items-center"
                whileTap={{ scale: 0.95 }}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Submit for Grading</span>
                <span className="sm:hidden">Submit</span>
              </motion.span>
            )}
          </Button>
          <span className="text-[10px] text-muted-foreground/50 hidden sm:inline flex-shrink-0">
            {mode === "terminal"
              ? "Grade your code in rendu/"
              : "Ctrl+Enter"}
          </span>
          {cooldown && (
            <motion.span
              className="text-xs text-amber-600 font-medium flex-shrink-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Cooldown: {cooldown.remaining}s
            </motion.span>
          )}
          <div className="flex-1 min-w-0" />
          <span className="text-[11px] text-muted-foreground font-medium truncate min-w-0">
            L{currentLevel} · {exercise?.name}
          </span>
        </div>

        {/* Feedback panel */}
        <AnimatePresence>
          {showNewLevel && (
            <motion.div
              className="border-t px-4 py-5 flex-shrink-0 bg-emerald-500/5 border-emerald-500/20"
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              transition={{ duration: 0.1 }}
            >
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </motion.div>
                Passed! Advancing to level {currentLevel + 1}...
              </div>
            </motion.div>
          )}

          {feedback && !showNewLevel && !feedback.passed && (
            <motion.div
              className="border-t px-5 py-4 flex-shrink-0 bg-red-500/5 border-red-500/20 overflow-y-auto scrollbar-thin"
              style={{ maxHeight: 200 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.1 }}
            >
              <motion.div
                className="text-red-600 text-sm font-semibold mb-2"
                initial={{ x: -8 }}
                animate={{ x: 0 }}
              >
                ❌ Failed — {feedback.compilationError
                  ? "Compilation error"
                  : "Tests didn't match"}
              </motion.div>
              <pre
                ref={outputRef}
                className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground leading-relaxed"
              >
                {feedback.traceback || feedback.compilationError}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
