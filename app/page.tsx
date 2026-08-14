"use client";

import { moduleOrder, modules, type Exercise } from "@/lib/modules";
import Link from "next/link";
import { ProgressBar, Badge } from "@heroui/react";
import { motion } from "framer-motion";
import { Terminal, Code2, ChevronRight, Trophy, GraduationCap } from "lucide-react";
import { useState, useEffect } from "react";
import { panelClasses } from "@/components/Panel";
import { DURATION, SPRING_POP, staggerContainer, staggerItem } from "@/lib/motion";

function computeProgress() {
  const p: Record<string, number> = {};
  let done = 0;
  let total = 0;
  if (typeof window === "undefined") return { p, done, total };
  moduleOrder.forEach((id) => {
    const mod = modules[id as keyof typeof modules];
    if (!mod) return;
    let c = 0;
    mod.exercises.forEach((ex: Exercise) => {
      total++;
      if (localStorage.getItem(`progress:${mod.id}:${ex.id}`) === "done") {
        c++;
        done++;
      }
    });
    // Guard on this module's own exercise count, not the running total
    // across all modules processed so far (which is >0 after the first
    // module regardless of this one) — that guard doesn't protect the
    // division it's next to.
    p[id] = mod.exercises.length > 0 ? Math.round((c / mod.exercises.length) * 100) : 0;
  });
  return { p, done, total };
}

const EMPTY_PROGRESS = { p: {} as Record<string, number>, done: 0, total: 0 };

export default function Home() {
  // Starts at the same all-zero shape the server renders (computeProgress()
  // itself returns this when window is undefined) rather than computing
  // real numbers in a useState initializer — that ran on the client's very
  // first render too, before hydration reconciled, so whether the stat
  // pill/progress bar render at all differed between server and client
  // (confirmed via a real hydration-mismatch diff). Corrected below in an
  // effect instead, matching the pattern used elsewhere in this codebase
  // for the same class of bug.
  const [{ p: progress, done: totalCompleted, total: totalExercises }, setProgressState] =
    useState(EMPTY_PROGRESS);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressState(computeProgress());
  }, []);

  const overallPct = totalExercises > 0 ? Math.round((totalCompleted / totalExercises) * 100) : 0;

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base }}
    >
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
          <div>
            <h1 className="page-title">42 Piscine</h1>
            <p className="text-sm text-muted-foreground mt-1">Master C programming. 13 modules, 95+ exercises.</p>
          </div>
          {totalExercises > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, ...SPRING_POP }}
              className={panelClasses({ className: "flex items-center gap-3 bg-muted/50 px-4 py-3" })}
            >
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums">{totalCompleted}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Done</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums">{totalExercises}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums text-primary">{overallPct}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Complete</div>
              </div>
            </motion.div>
          )}
        </div>
        {totalExercises > 0 && (
          <ProgressBar value={overallPct} color={overallPct === 100 ? "success" : "accent"} size="sm" className="max-w-md" />
        )}
      </motion.div>

      {/* Shell Section */}
      <Section title="Shell" icon={<Terminal className="h-4 w-4" />} color="emerald">
        {moduleOrder
          .filter((id) => modules[id as keyof typeof modules]?.type === "shell")
          .map((id) => (
            <ModuleRow key={id} id={id} progress={progress[id] || 0} />
          ))}
      </Section>

      {/* C Section */}
      <Section title="C Language" icon={<Code2 className="h-4 w-4" />} color="accent">
        {moduleOrder
          .filter((id) => modules[id as keyof typeof modules]?.type === "c")
          .map((id) => (
            <ModuleRow key={id} id={id} progress={progress[id] || 0} />
          ))}
      </Section>

      {/* Exam Gate */}
      <motion.div
        className="border-t pt-6 mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Link
          href="/exam"
          className="flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-muted/50 transition-colors group no-underline border border-dashed hover:border-border"
        >
          <div className="h-10 w-10 rounded-lg flex items-center justify-center text-amber-500 bg-amber-500/10">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold">Exam Gate</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Take timed exams, practice exam exercises, track your scores.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="soft" color="warning" size="sm">
              New
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-500/10",
    primary: "text-primary bg-primary/10",
  };
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-6 w-6 rounded flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          {icon}
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      <motion.div
        className="space-y-1.5"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {children}
      </motion.div>
    </div>
  );
}

function ModuleRow({ id, progress }: { id: string; progress: number }) {
  const mod = modules[id as keyof typeof modules];
  if (!mod) return null;

  return (
    <motion.div variants={staggerItem}>
    <Link
      href={`/${mod.id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors group no-underline border border-transparent hover:border-border"
    >
      <div className="w-20 flex-shrink-0">
        <span className="text-sm font-semibold tabular-nums">{mod.title}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{mod.description}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {progress === 100 ? (
          <Trophy className="h-4 w-4 text-emerald-500" />
        ) : (
          <div className="w-24">
            <ProgressBar value={progress} color={progress > 0 ? "accent" : "default"} size="sm" />
          </div>
        )}
        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
          {progress}%
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
      </div>
    </Link>
    </motion.div>
  );
}
