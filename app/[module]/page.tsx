"use client";

import { modules, type Exercise } from "@/lib/modules";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge } from "@heroui/react";
import ProgressTracker from "@/components/ProgressTracker";
import { ChevronRight, Lock, CheckCircle2, Circle, Terminal, Code2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function ModulePage() {
  const params = useParams<{ module: string }>();
  const mod = modules[params.module as keyof typeof modules];

  if (!mod) notFound();

  return <ModulePageInner mod={mod} />;
}

function ModulePageInner({ mod }: { mod: typeof modules[keyof typeof modules] }) {
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    const done: string[] = [];
    mod.exercises.forEach((ex: Exercise) => {
      if (localStorage.getItem(`progress:${mod.id}:${ex.id}`) === "done") {
        done.push(ex.id);
      }
    });
    setCompleted(done);
  }, [mod.id, mod.exercises]);

  const xp = completed.length * 50;

  const isUnlocked = (index: number) => {
    if (index === 0) return true;
    const prev = mod.exercises[index - 1];
    return completed.includes(prev.id);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors no-underline">
            Modules
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{mod.title}</span>
        </div>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mod.type === "shell" ? (
                <Terminal className="inline h-7 w-7 mr-2 text-emerald-500" />
              ) : (
                <Code2 className="inline h-7 w-7 mr-2 text-primary" />
              )}
              {mod.title}
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">{mod.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">Version {mod.version}</p>
          </div>
          <div className="w-full sm:w-64">
            <ProgressTracker completed={completed.length} total={mod.exercises.length} xp={xp} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {mod.exercises.map((ex: Exercise, index: number) => {
          const isDone = completed.includes(ex.id);
          const unlocked = isUnlocked(index);

          return (
            <Link
              key={ex.id}
              href={unlocked ? `/${mod.id}/${ex.id}` : "#"}
              className={`block no-underline ${!unlocked ? "pointer-events-none" : ""}`}
            >
              <Card
                className={`transition-all ${
                  unlocked ? "hover:shadow-md cursor-pointer hover:-translate-y-0.5" : "opacity-50"
                } border`}
              >
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    ) : unlocked ? (
                      <Circle className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Lock className="h-6 w-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Exercise {String(ex.number).padStart(2, "0")}:</span>
                      <span className="font-semibold">{ex.title}</span>
                      {isDone && (
                        <Badge variant="soft" color="success" size="sm">
                          Done
                        </Badge>
                      )}
                      {"prototype" in ex && (
                        <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono hidden sm:inline">
                          {ex.prototype}
                        </code>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{ex.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
