"use client";

import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, ChevronLeft, BookOpen, Lightbulb, PanelLeftClose, PanelLeftOpen, PanelBottomClose, PanelBottomOpen } from "lucide-react";
import { getExamWeekOrNull, lockedWeeks } from "@/lib/exam-data";
import type { ExamExercise } from "@/lib/exam-data";
import CodeEditor from "@/components/CodeEditor";
import { ExplanationPanel, buildExplanationPrompt } from "@/components/ExplanationPanel";

export default function ExamPrepExercisePage() {
  const params = useParams<{
    id: string;
    level: string;
    exercise: string;
  }>();
  const weekId = params.id;

  if (lockedWeeks[weekId as keyof typeof lockedWeeks]) notFound();

  const week = getExamWeekOrNull(weekId);
  if (!week) notFound();

  const lvl = parseInt(params.level, 10);
  const ex = week.exercises.find(
    (e) => e.level === lvl && e.name === params.exercise,
  );
  if (!ex) notFound();

  // Remount on exercise change so code/output don't carry over between
  // different prep exercises without a full page reload.
  return (
    <PrepPracticeInner
      key={`${weekId}:${lvl}:${ex.name}`}
      weekId={weekId}
      exercise={ex}
    />
  );
}

function PrepPracticeInner({
  weekId,
  exercise,
}: {
  weekId: string;
  exercise: ExamExercise;
}) {
  const week = getExamWeekOrNull(weekId)!;
  const codeKey = `exam:code:${weekId}:${exercise.level}:${exercise.name}`;
  const prepKey = `exam:prep:${weekId}:${exercise.level}:${exercise.name}`;
  const explanationCacheKey = `explanation:exam:v1:${weekId}:${exercise.level}:${exercise.name}`;
  const explanationPrompt = buildExplanationPrompt({
    context: `Exam: ${week.title}, Level ${exercise.level}`,
    title: exercise.name,
    description: exercise.subject.description,
    allowed: exercise.subject.allowed,
  });

  const [code, setCode] = useState(() => (typeof window !== "undefined" && localStorage.getItem(codeKey)) || "");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [leftTab, setLeftTab] = useState<"exercise" | "explanation">(
    "exercise",
  );
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [outputOpen, setOutputOpen] = useState(true);
  const outputRef = useRef<HTMLPreElement>(null);

  const markAsSeen = () => {
    localStorage.setItem(prepKey, "done");
  };

  useEffect(() => {
    markAsSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepKey]);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleRun = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setOutput("");
    setOutputOpen(true);
    markAsSeen();

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          exerciseId: exercise.name,
          moduleId: weekId,
        }),
      });
      const data = await res.json();
      setOutput(data.output || data.error || "(no output)");
    } catch {
      setOutput("Execution failed");
    }
    setRunning(false);
  };

  return (
    <motion.div
      className="flex flex-col h-[calc(100vh-3.5rem)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
    >
      <div
        className="border-b px-3 sm:px-4 flex items-center gap-2 sm:gap-3 flex-shrink-0 bg-background overflow-hidden"
        style={{ height: 38 }}
      >
        <Link
          href={`/exam/week/${weekId}/prep`}
          className="text-xs text-muted-foreground hover:text-foreground no-underline flex items-center gap-1 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />{" "}
          <span className="hidden sm:inline">{weekId.replace("_", " ").toUpperCase()} Prep</span>
        </Link>
        <span className="text-muted-foreground/40 text-xs hidden sm:inline flex-shrink-0">/</span>
        <span className="text-sm font-semibold truncate min-w-0">{exercise.name}</span>
        <span className="text-[11px] text-muted-foreground flex-shrink-0">
          Level {exercise.level}
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {leftPanelOpen ? (
        <motion.div
          className="w-full h-[32vh] lg:h-full lg:w-[340px] border-b lg:border-b-0 lg:border-r flex flex-col flex-shrink-0 overflow-hidden min-h-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="flex items-center border-b bg-muted/30 flex-shrink-0"
            style={{ height: 40 }}
          >
            {[
              { k: "exercise" as const, icon: BookOpen, label: "Exercise" },
              {
                k: "explanation" as const,
                icon: Lightbulb,
                label: "Explanation",
              },
            ].map((tab) => (
              <motion.button
                key={tab.k}
                onClick={() => setLeftTab(tab.k)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-full text-xs font-medium transition-all ${
                  leftTab === tab.k
                    ? "text-foreground border-b-2 border-primary bg-background"
                    : "text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:bg-muted/50"
                }`}
                whileHover={{ backgroundColor: "var(--muted)" }}
              >
                <tab.icon className="h-3.5 w-3.5" /> {tab.label}
              </motion.button>
            ))}
            <button
              onClick={() => setLeftPanelOpen(false)}
              aria-label="Hide exercise panel"
              title="Hide panel"
              className="h-full px-2.5 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin min-h-0">
            <AnimatePresence mode="wait">
              {leftTab === "exercise" ? (
                <motion.div
                  key="exercise"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {exercise.subject.description}
                  </p>

                  {exercise.subject.files.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Turn-in files
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.subject.files.map((f: string) => (
                          <span
                            key={f}
                            className="text-xs px-2 py-0.5 rounded-md bg-muted/50 font-mono text-muted-foreground"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {exercise.subject.allowed.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Allowed functions
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.subject.allowed.map((fn: string) => (
                          <span
                            key={fn}
                            className="text-xs px-2 py-0.5 rounded-md bg-muted font-mono text-muted-foreground border"
                          >
                            {fn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-muted-foreground/60 border-t pt-3">
                    {exercise.testCases.length} test cases ·{" "}
                    {exercise.type} exercise
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="explanation"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                >
                  <ExplanationPanel
                    cacheKey={explanationCacheKey}
                    prompt={explanationPrompt}
                  />
                  <p className="text-[11px] text-muted-foreground/60 border-t pt-2 mt-3">
                    In the real exam, no explanations are available. Practice
                    without them when ready.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        ) : (
          <div className="w-full h-8 lg:h-full lg:w-8 border-b lg:border-b-0 lg:border-r flex-shrink-0 flex lg:flex-col items-center bg-muted/20">
            <button
              onClick={() => setLeftPanelOpen(true)}
              aria-label="Show exercise panel"
              title="Show panel"
              className="h-8 w-8 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
            <span className="hidden lg:block text-[10px] text-muted-foreground uppercase tracking-wider [writing-mode:vertical-rl] mt-2 select-none">
              Exercise
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div
            className="border-b px-3 flex items-center gap-2 bg-muted/30 flex-shrink-0"
            style={{ height: 40 }}
          >
            <Button
              variant="primary"
              size="sm"
              onPress={handleRun}
              isDisabled={running}
              className="font-semibold"
            >
              {running ? (
                <motion.span
                  className="flex items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Running
                </motion.span>
              ) : (
                <motion.span
                  className="flex items-center"
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Run
                </motion.span>
              )}
            </Button>
            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
              Runs against {exercise.testCases.length} test case{exercise.testCases.length === 1 ? "" : "s"} — see output only, no pass/fail
            </span>
            <div className="flex-1" />
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              onPress={() => setOutputOpen((o) => !o)}
              aria-label={outputOpen ? "Hide output" : "Show output"}
              className="hover:bg-muted transition-colors"
            >
              {outputOpen ? <PanelBottomClose className="h-3.5 w-3.5" /> : <PanelBottomOpen className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="flex-1 relative bg-white dark:bg-[#1e1e1e] min-h-[120px]">
            <CodeEditor
              value={code}
              onChange={(v) => {
                const val = v || "";
                setCode(val);
                localStorage.setItem(codeKey, val);
              }}
              language="c"
            />
          </div>

          <AnimatePresence initial={false}>
            {outputOpen && (
              <motion.div
                className="flex-shrink-0 border-t bg-white dark:bg-zinc-950 overflow-hidden"
                initial={{ height: 0 }}
                animate={{ height: "min(160px, 30vh)" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <div className="px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Output
                  </span>
                  {running && (
                    <motion.span
                      className="text-[10px] text-amber-600 dark:text-amber-400 ml-2"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    >
                      running...
                    </motion.span>
                  )}
                </div>
                <pre
                  ref={outputRef}
                  className="p-3 font-mono text-[13px] leading-relaxed overflow-y-auto scrollbar-thin whitespace-pre-wrap break-all"
                  style={{ height: "calc(100% - 33px)" }}
                >
                  {output || (
                    <span className="text-zinc-400 dark:text-zinc-600">
                      Write your code and press Run
                    </span>
                  )}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
