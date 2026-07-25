"use client";

import { ProgressBar } from "@heroui/react";
import { Trophy, Target, Zap } from "lucide-react";

export default function ProgressTracker({
  completed,
  total,
  xp = 0,
}: {
  completed: number;
  total: number;
  xp?: number;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          <span>Progress</span>
        </div>
        <span className="font-medium tabular-nums">
          {completed}/{total}
        </span>
      </div>
      <ProgressBar value={pct} color={pct === 100 ? "success" : "accent"} size="sm" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-500" />
          <span>{xp} XP</span>
        </div>
        {pct === 100 && (
          <div className="flex items-center gap-1 text-emerald-500">
            <Trophy className="h-3 w-3" />
            <span>Completed</span>
          </div>
        )}
      </div>
    </div>
  );
}
