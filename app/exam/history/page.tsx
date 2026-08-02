"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Trophy, Clock, XCircle, Terminal, Monitor } from "lucide-react";

type LevelEntry = {
  level: number;
  exercise: string;
  passed: boolean;
  attempts: number;
  timeSpentSeconds?: number;
};

type HistoryEntry = {
  id: string;
  weekId: string;
  mode: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  result: string;
  finalGrade: number;
  levels: LevelEntry[];
};

const WEEK_LABELS: Record<string, string> = {
  exam_01: "Exam Week 01",
  exam_02: "Exam Week 02",
  exam_03: "Exam Week 03",
};

export default function ExamHistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("exam:history");
      if (raw) {
        setHistory(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  const filtered =
    filter === "all"
      ? history
      : history.filter((h) => h.weekId === filter);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const weekIds = [...new Set(history.map((h) => h.weekId))];

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/exam"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline mb-6"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Exam Gate
      </Link>

      <h1 className="text-2xl font-bold mb-2">Exam History</h1>
      <p className="text-sm text-muted-foreground mb-6">
        All your past exam attempts.
      </p>

      {history.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No attempts yet</p>
          <p className="text-sm">
            <Link href="/exam" className="text-primary hover:underline">
              Take your first exam
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-muted-foreground mr-1">Filter:</span>
            {["all", ...weekIds].map((w) => (
              <button
                key={w}
                onClick={() => setFilter(w)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === w
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                {w === "all" ? "All" : WEEK_LABELS[w] || w}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const passedCount = entry.levels.filter((l) => l.passed).length;
              const totalAttempts = entry.levels.reduce((s, l) => s + l.attempts, 0);

              return (
                <div
                  key={entry.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex-shrink-0">
                      {entry.result === "completed" ? (
                        <Trophy className="h-4 w-4 text-emerald-500" />
                      ) : entry.result === "timeout" ? (
                        <Clock className="h-4 w-4 text-amber-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {WEEK_LABELS[entry.weekId] || entry.weekId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.mode === "editor" ? (
                          <Monitor className="h-3 w-3 inline mr-1" />
                        ) : (
                          <Terminal className="h-3 w-3 inline mr-1" />
                        )}
                        {formatDate(entry.startedAt)} · {formatTime(entry.duration)} · {passedCount}/{entry.levels.length} levels
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold tabular-nums">
                        {entry.finalGrade}/100
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {entry.result}
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-muted/10">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <div className="text-sm font-bold">{passedCount}</div>
                          <div className="text-[10px] text-muted-foreground">Passed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold">{totalAttempts}</div>
                          <div className="text-[10px] text-muted-foreground">Attempts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold">
                            {entry.levels.length ? Math.round((passedCount / entry.levels.length) * 100) : 0}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">Rate</div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {entry.levels.map((lvl) => (
                          <div
                            key={lvl.level}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                lvl.passed ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            <span className="text-muted-foreground w-10 tabular-nums">
                              L{lvl.level}
                            </span>
                            <span className="font-mono">{lvl.exercise}</span>
                            <span className="text-muted-foreground ml-auto">
                              {lvl.attempts} attempt{lvl.attempts > 1 ? "s" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
