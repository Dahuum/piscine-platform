"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Clock,
  XCircle,
} from "lucide-react";
import { getExamWeekOrNull } from "@/lib/exam-data";

type LevelEntry = {
  level: number;
  exercise: string;
  passed: boolean;
  attempts: number;
  timeSpentSeconds?: number;
};

type AttemptData = {
  id?: string;
  weekId: string;
  mode: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  result: string;
  finalGrade: number;
  levels: LevelEntry[];
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
} as const;

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
} as const;

export default function ExamResultsPage() {
  const params = useParams<{ id: string }>();
  const weekId = params.id;
  const week = getExamWeekOrNull(weekId);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(
    new Set(),
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("exam:history");
      if (raw) {
        const history: AttemptData[] = JSON.parse(raw);
        const latest = history.find((a) => a.weekId === weekId);
        if (latest) setAttempt(latest);
      }
    } catch {
      // ignore
    }
  }, [weekId]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h > 0 ? h + "h " : ""}${m}min ${s}s`;
  };

  const toggleLevel = (lvl: number) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  if (!attempt) {
    return (
      <motion.div
        className="max-w-lg mx-auto px-4 py-16 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">No results yet</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Complete an exam for {week?.title || weekId} to see results
          here.
        </p>
        <Link href={`/exam/week/${weekId}/take`}>
          <Button variant="primary">Take Exam</Button>
        </Link>
      </motion.div>
    );
  }

  const passedCount = attempt.levels.filter((l) => l.passed).length;
  const totalAttempts = attempt.levels.reduce(
    (s, l) => s + l.attempts,
    0,
  );
  const successRate = attempt.levels.length
    ? Math.round((passedCount / attempt.levels.length) * 100)
    : 0;

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        href="/exam"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline mb-6 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Exam Gate
      </Link>

      {/* Hero card */}
      <motion.div
        className={`rounded-xl border p-6 mb-8 text-center ${
          attempt.result === "completed"
            ? "bg-emerald-500/5 border-emerald-500/20"
            : attempt.result === "timeout"
              ? "bg-amber-500/5 border-amber-500/20"
              : "bg-muted/20"
        }`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        >
          {attempt.result === "completed" ? (
            <Trophy className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          ) : attempt.result === "timeout" ? (
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          ) : (
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          )}
        </motion.div>

        <h1 className="text-2xl font-bold mb-1">
          {attempt.result === "completed"
            ? "Exam Completed"
            : attempt.result === "timeout"
              ? "Time Expired"
              : "Exam Ended"}
        </h1>
        <motion.div
          className="text-5xl font-bold tabular-nums mt-3 mb-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {attempt.finalGrade}/100
        </motion.div>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>
            {passedCount} of {attempt.levels.length} levels
          </span>
          <span>·</span>
          <span>{formatTime(attempt.duration)}</span>
          <span>·</span>
          <span>{attempt.mode} mode</span>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-3 gap-3 mb-8"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {[
          { label: "Passed", value: String(passedCount) },
          { label: "Attempts", value: String(totalAttempts) },
          { label: "Success", value: `${successRate}%` },
        ].map((s) => (
          <motion.div
            key={s.label}
            variants={item}
            className="rounded-lg border p-3 text-center"
          >
            <div className="text-lg font-bold tabular-nums">
              {s.value}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {s.label}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Level breakdown */}
      <motion.h2
        className="text-sm font-semibold mb-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Level Breakdown
      </motion.h2>
      <motion.div
        className="space-y-1"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {attempt.levels.map((lvl) => (
          <motion.div
            key={lvl.level}
            variants={item}
            className="border rounded-lg overflow-hidden transition-shadow hover:border-primary/20"
          >
            <motion.button
              onClick={() => toggleLevel(lvl.level)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
              whileHover={{ backgroundColor: "var(--muted)" }}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  lvl.passed ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm">
                Level {lvl.level}:{" "}
                <span className="font-mono">{lvl.exercise}</span>
              </span>
              <div className="flex-1" />
              <span
                className={`text-xs font-medium ${
                  lvl.passed
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {lvl.passed ? "Passed" : "Failed"}
              </span>
              <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                {lvl.attempts} attempt
                {lvl.attempts > 1 ? "s" : ""}
              </span>
              <motion.span
                animate={{
                  rotate: expandedLevels.has(lvl.level)
                    ? 90
                    : 0,
                }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.span>
            </motion.button>

            <AnimatePresence>
              {expandedLevels.has(lvl.level) && (
                <motion.div
                  className="border-t px-4 py-2.5 bg-muted/10"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong className="text-foreground/80">
                        Exercise:
                      </strong>{" "}
                      {lvl.exercise}
                    </p>
                    <p>
                      <strong className="text-foreground/80">
                        Status:
                      </strong>{" "}
                      {lvl.passed
                        ? "Passed ✅"
                        : "Failed ❌"}
                    </p>
                    <p>
                      <strong className="text-foreground/80">
                        Attempts:
                      </strong>{" "}
                      {lvl.attempts}
                    </p>
                    {lvl.timeSpentSeconds !== undefined && (
                      <p>
                        <strong className="text-foreground/80">
                          Time:
                        </strong>{" "}
                        {formatTime(lvl.timeSpentSeconds)}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="flex justify-center gap-3 mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Link href={`/exam/week/${weekId}/take`}>
          <Button variant="primary">Retake Exam</Button>
        </Link>
        <Link href="/exam">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}
