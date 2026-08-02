"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, ProgressBar } from "@heroui/react";
import { motion } from "framer-motion";
import { Terminal, BookOpen, Lock, ChevronRight } from "lucide-react";
import { examWeeks, lockedWeeks } from "@/lib/exam-data";

type Stat = { label: string; value: string };

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
} as const;

export default function ExamGateDashboard() {
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<Stat[]>([
    { label: "Exams", value: "0" },
    { label: "Best", value: "—" },
    { label: "Hours", value: "0h" },
    { label: "Pass", value: "—" },
  ]);

  useEffect(() => {
    const r: Record<string, boolean> = {};
    for (const id of Object.keys(examWeeks)) {
      r[id] =
        localStorage.getItem(`exam:prep:reviewed:${id}`) === "true";
    }
    setReviewed(r);

    try {
      const raw = localStorage.getItem("exam:history");
      if (raw) {
        const history = JSON.parse(raw) as {
          weekId: string;
          finalGrade: number;
          result: string;
          duration: number;
        }[];
        const total = history.length;
        const best = history.length
          ? Math.max(...history.map((a) => a.finalGrade))
          : 0;
        const hours = Math.round(
          history.reduce((s, a) => s + (a.duration || 0), 0) / 3600,
        );
        const passes = history.filter(
          (a) => a.result === "completed",
        ).length;
        const passRate = total
          ? Math.round((passes / total) * 100)
          : 0;

        setStats([
          { label: "Exams", value: String(total) },
          { label: "Best", value: `${best}%` },
          { label: "Hours", value: `${hours}h` },
          { label: "Pass", value: `${passRate}%` },
        ]);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10"
            whileHover={{ scale: 1.05 }}
          >
            <Terminal className="h-5 w-5 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold">Exam Gate</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Practice and take the 42 piscine exams. 3 exam weeks available.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            variants={item}
            className="rounded-xl border bg-muted/20 p-4 text-center hover:bg-muted/30 transition-colors"
          >
            <div className="text-xl font-bold tabular-nums">
              {s.value}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              {s.label}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Week cards */}
      <motion.div
        className="space-y-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {[...Object.values(examWeeks), ...Object.values(lockedWeeks)].map(
          (week) => {
            const isLocked = "comingSoon" in week;
            const isReviewed = reviewed[week.id] || false;
            const exCount =
              "exercises" in week ? week.exercises.length : 0;

            return (
              <motion.div
                key={week.id}
                variants={item}
                className={`rounded-xl border p-5 transition-all duration-200 ${
                  isLocked
                    ? "opacity-50"
                    : "hover:border-primary/30 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-lg">
                        {week.title}
                      </h2>
                      {isLocked && (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 max-w-lg">
                      {week.description}
                    </p>
                  </div>
                  {!isLocked && (
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {exCount} exercises ·{" "}
                      {"levelCount" in week ? week.levelCount : 0} levels · 240
                      min
                    </div>
                  )}
                </div>

                {isLocked ? (
                  <div className="flex items-center gap-2 py-3">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Coming soon — exercises being prepared
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs text-muted-foreground w-16 font-medium">
                        Prep
                      </span>
                      <ProgressBar
                        value={isReviewed ? 100 : 0}
                        color={isReviewed ? "success" : "default"}
                        size="sm"
                        className="flex-1 max-w-xs"
                      />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {isReviewed ? "Reviewed" : "Not reviewed"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/exam/week/${week.id}/prep`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-muted hover:bg-muted/70 transition-colors no-underline text-foreground"
                      >
                        <BookOpen className="h-4 w-4" />
                        Preparation
                      </Link>
                      {isReviewed ? (
                        <Link
                          href={`/exam/week/${week.id}/take`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors no-underline"
                        >
                          Start Exam
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          isDisabled
                          className="text-sm"
                        >
                          <Lock className="h-3.5 w-3.5 mr-1" />
                          Review prep first
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            );
          },
        )}
      </motion.div>

      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Link
          href="/exam/history"
          className="text-sm text-muted-foreground hover:text-foreground no-underline inline-flex items-center gap-1 transition-colors"
        >
          View exam history
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>
    </motion.div>
  );
}
