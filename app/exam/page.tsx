"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, ProgressBar } from "@heroui/react";
import { motion } from "framer-motion";
import { Terminal, BookOpen, Lock, ChevronRight } from "lucide-react";
import { examWeeks, lockedWeeks } from "@/lib/exam-data";
import { getExamHistory, getPrepReview } from "@/lib/db";
import { panelClasses } from "@/components/Panel";
import { DURATION, staggerContainer, staggerItem } from "@/lib/motion";

type Stat = { label: string; value: string };

function processHistory(
  history: { finalGrade: number; result: string; duration: number }[],
) {
  const total = history.length;
  const best = total ? Math.max(...history.map((a) => a.finalGrade)) : 0;
  const hours = Math.round(
    history.reduce((s, a) => s + (a.duration || 0), 0) / 3600,
  );
  const passes = history.filter((a) => a.result === "completed").length;
  const passRate = total ? Math.round((passes / total) * 100) : 0;
  return [
    { label: "Exams", value: String(total) },
    { label: "Best", value: `${best}%` },
    { label: "Hours", value: `${hours}h` },
    { label: "Pass", value: `${passRate}%` },
  ];
}

export default function ExamGateDashboard() {
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<Stat[]>([
    { label: "Exams", value: "0" },
    { label: "Best", value: "—" },
    { label: "Hours", value: "0h" },
    { label: "Pass", value: "—" },
  ]);

  useEffect(() => {
    (async () => {
      const r: Record<string, boolean> = {};
      for (const id of Object.keys(examWeeks)) {
        r[id] = localStorage.getItem(`exam:prep:reviewed:${id}`) === "true";
        try {
          const dbReviewed = await getPrepReview(id);
          if (dbReviewed) r[id] = true;
        } catch {}
      }
      setReviewed(r);

      try {
        const dbHistory = await getExamHistory();
        if (dbHistory.length > 0) {
          setStats(processHistory(dbHistory));
          return;
        }
      } catch {}

      try {
        const raw = localStorage.getItem("exam:history");
        if (raw) {
          const history = JSON.parse(raw) as { finalGrade: number; result: string; duration: number }[];
          setStats(processHistory(history));
          return;
        }
      } catch {}
    })();
  }, []);

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base }}
    >
      <motion.div
        className="mb-12"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            className="h-9 w-9 rounded-lg flex items-center justify-center bg-muted"
            whileHover={{ scale: 1.05 }}
          >
            <Terminal className="h-5 w-5 text-foreground" />
          </motion.div>
          <h1 className="page-title">Exam Gate</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Practice and take the 42 piscine exams. {Object.keys(examWeeks).length} exam weeks available.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            variants={staggerItem}
            className={panelClasses({ className: "bg-muted/20 p-4 text-center hover:bg-muted/30 transition-colors" })}
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
        variants={staggerContainer}
        initial="initial"
        animate="animate"
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
                variants={staggerItem}
                className={panelClasses({ hover: !isLocked, glow: !isLocked, className: `p-5 ${isLocked ? "opacity-50" : ""}` })}
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
        transition={{ delay: 0.08 }}
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
