"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";
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
import { getExamWeekOrNull, lockedWeeks } from "@/lib/exam-data";
import type { ExamExercise } from "@/lib/exam-data";
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
    { level: number; exercise: string; passed: boolean; attempts: number }[]>([]);
  const [status, setStatus] = useState<string>("active");
  const [examComplete, setExamComplete] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const terminalGradeRef = useRef<(() => void) | null>(null);
  const [terminalSandbox, setTerminalSandbox] = useState<{ sandboxId: string; pid: number } | null>(null);

  const getVisitorId = () =>
    typeof window !== "undefined"
      ? localStorage.getItem("visitor-id") || Math.random().toString(36).slice(2, 10)
      : Math.random().toString(36).slice(2, 10);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("visitor-id")) {
      localStorage.setItem("visitor-id", Math.random().toString(36).slice(2, 10));
    }
  }, []);

  const startExam = async (selectedMode: "editor" | "terminal") => {
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
      setExercise(data.exercise);
      setCode("");
      setCurrentLevel(0);
      setCurrentGrade(0);
      setFeedback(null);
      setCooldown(null);
      setStage("active");
      setStatus("active");
      setExamComplete(false);
      setTimeRemaining(data.timeLimitSeconds);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start";
      alert(msg);
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
        startedAt: Date.now() - (week.timeMinutes * 60 - timeRemaining) * 1000,
        endedAt: Date.now(),
        duration: week.timeMinutes * 60 - timeRemaining,
        result: status === "timeout" ? "timeout" : "completed",
        finalGrade: data.grade ?? currentGrade,
        levels: data.levelHistory || levelHistory,
      });
      localStorage.setItem("exam:history", JSON.stringify(history));
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
      fetch("/api/exam/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: "timeout" }),
      }).then((r) => r.json()).then((d) => {
        saveToHistory(d);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  useEffect(() => {
    if (cooldown && cooldown.remaining > 0) {
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (!prev) return null;
          const remaining = Math.max(0, Math.ceil((prev.until - Date.now()) / 1000));
          if (remaining <= 0) return null;
          return { ...prev, remaining };
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [cooldown]);

  const handleSubmit = async () => {
    if (!code.trim() || !token || grading) return;
    setGrading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/exam/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, studentCode: code }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setCooldown({
          until: Date.now() + data.cooldownRemaining,
          remaining: Math.ceil(data.cooldownRemaining / 1000),
        });
        setGrading(false);
        return;
      }

      if (data.error) {
        if (data.status === "timeout") {
          setStatus("timeout");
          setGrading(false);
          return;
        }
        setFeedback({ passed: false, traceback: data.error });
        setGrading(false);
        return;
      }

      if (data.passed) {
        if (data.examComplete) {
          setExamComplete(true);
          setCurrentGrade(data.finalGrade || 100);
          setLevelHistory(data.levelHistory || []);
          setStatus("completed");
          saveToHistory({ grade: data.finalGrade, levelHistory: data.levelHistory });
          fetch("/api/exam/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, reason: "completed" }),
          });
          return;
        }
        setFeedback({ passed: true });
        setCurrentLevel(data.newLevel);
        setCurrentGrade(data.grade);
        setLevelHistory(data.levelHistory);
        if (data.newExercise) setExercise(data.newExercise);
        setCode("");
        setCooldown(null);
      } else {
        setFeedback({
          passed: false,
          traceback: data.traceback,
          compilationError: data.compilationError,
        });
        if (data.cooldownSeconds > 0) {
          setCooldown({
            until: Date.now() + data.cooldownSeconds * 1000,
            remaining: data.cooldownSeconds,
          });
        }
      }
    } catch {
      setFeedback({ passed: false, traceback: "Network error" });
    }
    setGrading(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && stage === "active") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, code, token, grading]);

  const finishExam = async () => {
    if (token) {
      await fetch("/api/exam/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: "abandoned" }),
      });
    }
    router.push(`/exam/week/${weekId}/results`);
  };

  if (examComplete) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Trophy className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Exam Complete!</h1>
        <p className="text-muted-foreground mb-6">
          {status === "timeout" ? "Time ran out" : "All levels completed"}
        </p>
        <div className="text-4xl font-bold tabular-nums mb-3">
          {currentGrade}/100
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {levelHistory.filter((h) => h.passed).length} of {week.levelCount} levels passed
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="primary" onPress={() => router.push(`/exam/week/${weekId}/results`)}>
            View Results
          </Button>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retake
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "select") {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <Link
          href="/exam"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline mb-6"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Exam Gate
        </Link>

        <h1 className="text-2xl font-bold mb-2">{week.title} — Real Exam</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {week.description}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-lg border p-3 text-center">
            <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <div className="text-sm font-semibold">240 min</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-sm font-semibold">{week.levelCount} levels</div>
            <div className="text-[10px] text-muted-foreground">0 → {week.levelCount - 1}</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-sm font-semibold">{week.gradePerLevel} pts</div>
            <div className="text-[10px] text-muted-foreground">per level</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1.5 mb-8 border rounded-lg p-4">
          <p className="font-medium text-foreground mb-2">Rules:</p>
          <p>· No AI assistance during the exam</p>
          <p>· Random exercise drawn per level</p>
          <p>· Cooldown increases on repeated failures (Fibonacci)</p>
          <p>· Exam ends when all levels complete or time runs out</p>
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Choose mode
        </p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setMode("editor")}
            className={`rounded-lg border p-4 text-left transition-all ${
              mode === "editor"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:border-border"
            }`}
          >
            <Monitor className="h-5 w-5 mb-2 text-primary" />
            <div className="text-sm font-semibold">Editor</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Monaco editor + Run button
            </div>
          </button>
          <button
            onClick={() => setMode("terminal")}
            className={`rounded-lg border p-4 text-left transition-all ${
              mode === "terminal"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:border-border"
            }`}
          >
            <Terminal className={`h-5 w-5 mb-2 ${mode === "terminal" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-sm font-semibold">Terminal</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Real shell via xterm.js
            </div>
          </button>
        </div>

        <Button
          variant="primary"
          size="lg"
          onPress={() => setStage("confirm")}
          className="w-full"
        >
          Continue with {mode === "editor" ? "Editor" : "Terminal"}
        </Button>
      </div>
    );
  }

  if (stage === "confirm") {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <Clock className="h-10 w-10 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Ready to begin?</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {week.title} · {mode === "editor" ? "Editor" : "Terminal"} mode
          <br />
          Timer starts when you press Begin.
          <br />
          240 minutes · Cannot be paused.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onPress={() => setStage("select")}>
            Back
          </Button>
          <Button variant="primary" onPress={() => startExam(mode)}>
            Begin Exam
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div
        className="border-b px-4 flex items-center gap-4 flex-shrink-0 bg-background"
        style={{ height: 44 }}
      >
        <span
          className={`text-sm font-mono font-bold tabular-nums ${
            timeRemaining < 1800 ? "text-red-500" : "text-foreground"
          }`}
        >
          {formatTime(timeRemaining)}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-sm tabular-nums">
          Level {currentLevel}/{week.levelCount}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-sm tabular-nums">Grade {currentGrade}/100</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {Array.from({ length: week.levelCount }, (_, i) => {
            const historyEntry = levelHistory.find(
              (h) => h.level === i,
            );
            const isPassed = historyEntry?.passed;
            const isCurrent = i === currentLevel && !(status === "timeout");
            const isFailed = historyEntry && !historyEntry.passed;
            return (
              <div
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
                title={`Level ${i}${historyEntry ? `: ${historyEntry.exercise} (${historyEntry.passed ? "passed" : "failed"})` : ""}`}
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
      </div>

      {status === "timeout" && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-600">
          Time expired. Exam ended.
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {exercise && (
          <div className="border-b px-4 py-3 bg-muted/20 flex-shrink-0 max-h-[30%] overflow-y-auto scrollbar-thin">
            <h2 className="text-sm font-semibold mb-1">
              {exercise.name}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {exercise.subject.description}
            </p>
            {(exercise.subject.files.length > 0 ||
              exercise.subject.allowed.length > 0) && (
              <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-muted-foreground">
                {exercise.subject.files.length > 0 && (
                  <span>
                    Files:{" "}
                    <code className="text-foreground/70">
                      {exercise.subject.files.join(", ")}
                    </code>
                  </span>
                )}
                {exercise.subject.allowed.length > 0 && (
                  <span>
                    Allowed:{" "}
                    <code className="text-foreground/70">
                      {exercise.subject.allowed.join(", ")}
                    </code>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

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

        <div className="border-t px-3 py-2 flex items-center gap-3 flex-shrink-0 bg-muted/20">
          <Button
            variant="primary"
            size="sm"
            onPress={mode === "terminal" ? undefined : handleSubmit}
            isDisabled={
              mode === "terminal"
                ? !terminalSandbox || grading || cooldown !== null || status !== "active"
                : grading || !code.trim() || cooldown !== null || status !== "active"
            }
          >
            {grading ? (
              <>
                <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Grading...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Submit for Grading
              </>
            )}
          </Button>
          <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
            {mode === "terminal" ? "Grade your code in rendu/" : "Ctrl+Enter"}
          </span>
          {cooldown && (
            <span className="text-xs text-amber-600">
              Cooldown: {cooldown.remaining}s
            </span>
          )}
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground">
            Level {currentLevel} · {exercise?.name}
          </span>
        </div>

        {feedback && (
          <div
            className={`border-t px-4 py-3 flex-shrink-0 overflow-y-auto scrollbar-thin ${
              feedback.passed
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-red-500/5 border-red-500/20"
            }`}
            style={{ maxHeight: 180 }}
          >
            {feedback.passed ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Passed! Moving to next level...
              </div>
            ) : (
              <div>
                <div className="text-red-600 text-sm font-medium mb-2">
                  ❌ Failed
                </div>
                <pre
                  ref={outputRef}
                  className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground"
                >
                  {feedback.traceback || feedback.compilationError}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
