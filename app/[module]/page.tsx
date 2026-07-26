"use client";

import { modules, type Exercise } from "@/lib/modules";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { ProgressBar } from "@heroui/react";
import { ChevronRight, ChevronLeft, Lock, CheckCircle2, Circle, Terminal, Code2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

export default function ModulePage() {
  const params = useParams<{ module: string }>();
  const mod = modules[params.module as keyof typeof modules];
  if (!mod) notFound();
  return <ModulePageInner mod={mod} />;
}

function ModulePageInner({ mod }: { mod: typeof modules[keyof typeof modules] }) {
  const [completed, setCompleted] = useState<string[]>([]);
  const total = mod.exercises.length;
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  useEffect(() => {
    const done: string[] = [];
    mod.exercises.forEach((ex: Exercise) => {
      if (localStorage.getItem(`progress:${mod.id}:${ex.id}`) === "done") done.push(ex.id);
    });
    setCompleted(done);
  }, [mod.id, mod.exercises]);

  const isUnlocked = (index: number) => {
    if (index === 0) return true;
    return completed.includes(mod.exercises[index - 1].id);
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10">
      {/* Back + Header */}
      <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline mb-4">
        <ChevronLeft className="h-3.5 w-3.5" /> All Modules
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {mod.type === "shell" ? (
              <div className="h-7 w-7 rounded flex items-center justify-center text-emerald-500 bg-emerald-500/10">
                <Terminal className="h-4 w-4" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded flex items-center justify-center text-primary bg-primary/10">
                <Code2 className="h-4 w-4" />
              </div>
            )}
            <h1 className="text-2xl font-bold">{mod.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">{mod.summary}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-32">
            <ProgressBar value={pct} color={pct === 100 ? "success" : "accent"} size="sm" />
          </div>
          <div className="text-sm tabular-nums">
            <span className="font-semibold">{completed.length}</span>
            <span className="text-muted-foreground">/{total}</span>
          </div>
          {pct === 100 && <Trophy className="h-5 w-5 text-emerald-500" />}
        </div>
      </div>

      {/* Exercise list */}
      <div className="space-y-1">
        {mod.exercises.map((ex: Exercise, index: number) => {
          const isDone = completed.includes(ex.id);
          const unlocked = isUnlocked(index);

          return (
            <Link
              key={ex.id}
              href={unlocked ? `/${mod.id}/${ex.id}` : "#"}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group no-underline border border-transparent ${
                unlocked
                  ? "hover:bg-muted/50 hover:border-border cursor-pointer"
                  : "opacity-40 pointer-events-none"
              }`}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : unlocked ? (
                  <Circle className="h-5 w-5 text-muted-foreground/30" />
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground/20" />
                )}
              </div>

              {/* Number + Title */}
              <div className="w-16 flex-shrink-0">
                <span className={`text-xs font-semibold tabular-nums ${isDone ? "text-emerald-600" : "text-muted-foreground"}`}>
                  Ex {String(ex.number).padStart(2, "0")}
                </span>
              </div>

              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className={`text-sm font-medium truncate ${isDone ? "text-muted-foreground" : ""}`}>
                  {ex.title}
                </span>
                {"prototype" in ex && (
                  <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono hidden md:inline truncate">
                    {ex.prototype}
                  </code>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isDone && (
                  <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Done</span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
