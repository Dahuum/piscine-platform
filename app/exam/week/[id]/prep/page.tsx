"use client";

import { useParams, notFound } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, ProgressBar } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, BookOpen, CheckCircle2, Circle, Code2, Terminal,
} from "lucide-react";
import { getExamWeekOrNull, getAvailableLevels, lockedWeeks } from "@/lib/exam-data";
import { savePrepReview, savePrepExercise, getPrepReview, getPrepExercises } from "@/lib/db";
import { panelClasses } from "@/components/Panel";
import { DURATION } from "@/lib/motion";

const cardHover = { scale: 1.01, transition: { duration: DURATION.base } };
const cardTap = { scale: 0.98 };

export default function ExamPrepPage() {
  const params = useParams<{ id: string }>();
  const weekId = params.id;
  if (lockedWeeks[weekId as keyof typeof lockedWeeks]) notFound();
  const week = getExamWeekOrNull(weekId);
  if (!week) notFound();
  return <PrepInner weekId={weekId} />;
}

function PrepInner({ weekId }: { weekId: string }) {
  const week = getExamWeekOrNull(weekId)!;
  const levels = getAvailableLevels(week);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0]));
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const d = new Set<string>();
      try {
        const dbDone = await getPrepExercises(weekId);
        for (const key of dbDone) d.add(key);
      } catch {}
      for (const ex of week.exercises) {
        const key = `${ex.level}:${ex.name}`;
        if (localStorage.getItem(`exam:prep:${weekId}:${key}`) === "done") d.add(key);
      }
      setDone(d);

      try {
        const dbReviewed = await getPrepReview(weekId);
        if (dbReviewed) setReviewed(true);
      } catch {}
      if (localStorage.getItem(`exam:prep:reviewed:${weekId}`) === "true") setReviewed(true);

      setLoading(false);
    })();
  }, [weekId, week.exercises]);

  const totalDone = done.size;
  const totalExercises = week.exercises.length;
  const overallPct = totalExercises > 0 ? Math.round((totalDone / totalExercises) * 100) : 0;

  const toggleLevel = (lvl: number) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  const markReviewed = () => {
    const newVal = !reviewed;
    localStorage.setItem(`exam:prep:reviewed:${weekId}`, String(newVal));
    setReviewed(newVal);
    if (newVal) {
      savePrepReview(weekId).catch(() => {});
    }
  };

  const markExerciseDone = (lvl: number, name: string) => {
    const key = `${lvl}:${name}`;
    localStorage.setItem(`exam:prep:${weekId}:${key}`, "done");
    setDone((prev) => new Set(prev).add(key));
    savePrepExercise(weekId, lvl, name).catch(() => {});
  };

  const exercisesByLevel = week.exercisesByLevel;

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading preparation data...</p>
      </div>
    );
  }

  return (
    <motion.div className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.base }}>
      <Link href="/exam" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline mb-4 transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" /> Exam Gate
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded flex items-center justify-center bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <h1 className="page-title">{week.title} — Preparation</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Review all exercises before taking the real exam.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm tabular-nums">
            <span className="font-semibold">{totalDone}</span>
            <span className="text-muted-foreground">/ {totalExercises}</span>
          </div>
          <div className="w-32">
            <ProgressBar value={overallPct} color={overallPct === 100 ? "success" : "accent"} size="sm" />
          </div>
        </div>
      </div>

      <motion.div className="mb-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Button variant={reviewed ? "primary" : "outline"} size="sm" onPress={markReviewed} className="text-sm">
          {reviewed ? "✓ Reviewed — unlocks exam" : "Mark all as reviewed — unlock exam"}
        </Button>
        {reviewed && (
          <motion.span className="ml-3 text-xs text-emerald-600 font-medium" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Real exam is now unlocked
          </motion.span>
        )}
      </motion.div>

      <div className="space-y-2">
        {levels.map((lvl) => {
          const exercises = exercisesByLevel[lvl] || [];
          const lvlDone = exercises.filter((e) => done.has(`${lvl}:${e.name}`)).length;
          const lvlPct = exercises.length > 0 ? Math.round((lvlDone / exercises.length) * 100) : 0;
          const isExpanded = expandedLevels.has(lvl);

          return (
            <motion.div key={lvl} className={panelClasses({ hover: true, className: "overflow-hidden" })} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: lvl * 0.02 }}>
              <motion.button onClick={() => toggleLevel(lvl)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left" whileHover={{ backgroundColor: "var(--muted)" }}>
                <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.1 }}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.span>
                <span className="text-sm font-semibold">Level {lvl}</span>
                <span className="text-xs text-muted-foreground">{exercises.length} exercises</span>
                <div className="flex-1" />
                <span className="text-xs tabular-nums text-muted-foreground">{lvlDone}/{exercises.length}</span>
                <div className="w-20">
                  <ProgressBar value={lvlPct} color={lvlPct === 100 ? "success" : "accent"} size="sm" />
                </div>
              </motion.button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div className="border-t px-4 py-3" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.1 }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {exercises.map((ex) => {
                        const isDone = done.has(`${lvl}:${ex.name}`);
                        return (
                          <motion.div key={ex.name} whileHover={cardHover} whileTap={cardTap}>
                            <Link
                              href={`/exam/week/${weekId}/prep/${lvl}/${ex.name}`}
                              onClick={() => markExerciseDone(lvl, ex.name)}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:border-primary/30 hover:bg-muted/30 transition-colors no-underline text-foreground group"
                            >
                              <motion.div className="flex-shrink-0" animate={{ scale: isDone ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.12 }}>
                                {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground/30" />}
                              </motion.div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{ex.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {ex.type === "function" ? <Code2 className="h-3 w-3 text-muted-foreground" /> : <Terminal className="h-3 w-3 text-muted-foreground" />}
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {ex.type === "function" ? "Function" : "Program"}
                                    {ex.subject.allowed.length > 0 && ` · ${ex.subject.allowed.join(", ")}`}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors flex-shrink-0" />
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
