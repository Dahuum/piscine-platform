"use client";

import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { Play, RotateCcw, ChevronLeft, BookOpen, Lightbulb } from "lucide-react";
import { getExamWeekOrNull, lockedWeeks } from "@/lib/exam-data";
import type { ExamExercise } from "@/lib/exam-data";
import CodeEditor from "@/components/CodeEditor";

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

  return <PrepPracticeInner weekId={weekId} exercise={ex} />;
}

function PrepPracticeInner({
  weekId,
  exercise,
}: {
  weekId: string;
  exercise: ExamExercise;
}) {
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [leftTab, setLeftTab] = useState<"exercise" | "explanation">("exercise");
  const outputRef = useRef<HTMLPreElement>(null);

  const codeKey = `exam:code:${weekId}:${exercise.level}:${exercise.name}`;

  const prepKey = `exam:prep:${weekId}:${exercise.level}:${exercise.name}`;
  const markAsSeen = () => {
    localStorage.setItem(prepKey, "done");
  };

  useEffect(() => {
    const saved = localStorage.getItem(codeKey);
    if (saved) setCode(saved);
    markAsSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeKey]);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleRun = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setOutput("");
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b px-4 flex items-center gap-3 flex-shrink-0 bg-background" style={{ height: 38 }}>
        <Link
          href={`/exam/week/${weekId}/prep`}
          className="text-xs text-muted-foreground hover:text-foreground no-underline flex items-center gap-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {weekId.replace("_", " ").toUpperCase()} Prep
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-sm font-semibold">{exercise.name}</span>
        <span className="text-[11px] text-muted-foreground">
          Level {exercise.level}
        </span>
      </div>

      <div className="flex-1 flex lg:flex-row overflow-hidden min-h-0">
        <div className="lg:w-[340px] border-r flex flex-col flex-shrink-0 overflow-hidden min-h-0">
          <div className="flex border-b bg-muted/30 flex-shrink-0" style={{ height: 40 }}>
            <button
              onClick={() => setLeftTab("exercise")}
              className={`flex-1 flex items-center justify-center gap-1.5 h-full text-xs font-medium transition-all ${
                leftTab === "exercise"
                  ? "text-foreground border-b-2 border-primary bg-background"
                  : "text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> Exercise
            </button>
            <button
              onClick={() => setLeftTab("explanation")}
              className={`flex-1 flex items-center justify-center gap-1.5 h-full text-xs font-medium transition-all ${
                leftTab === "explanation"
                  ? "text-foreground border-b-2 border-primary bg-background"
                  : "text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" /> Tips
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin min-h-0">
            {leftTab === "exercise" ? (
              <ContentTab exercise={exercise} />
            ) : (
              <TipsTab exercise={exercise} />
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="border-b px-3 flex items-center gap-2 bg-muted/30 flex-shrink-0" style={{ height: 40 }}>
            <Button
              variant="primary"
              size="sm"
              onPress={handleRun}
              isDisabled={running}
              className="font-semibold"
            >
              {running ? <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {running ? "Running" : "Run"}
            </Button>
            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
              Tests your code — see output only
            </span>
          </div>

          <div className="flex-1 relative bg-white dark:bg-[#1e1e1e] min-h-[120px]">
            <CodeEditor
              value={code}
              onChange={(v) => {
                const val = v || "";
                setCode(val);
                localStorage.setItem(codeKey, val);
              }}
              language={exercise.type === "program" ? "c" : "c"}
            />
          </div>

          <div className="flex-shrink-0 border-t bg-white dark:bg-zinc-950" style={{ height: 160 }}>
            <div className="px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Output
              </span>
              {running && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 animate-pulse ml-2">
                  running...
                </span>
              )}
            </div>
            <pre
              ref={outputRef}
              className="p-3 font-mono text-[13px] leading-relaxed overflow-y-auto scrollbar-thin whitespace-pre-wrap break-all"
              style={{ height: 127 }}
            >
              {output || (
                <span className="text-zinc-400 dark:text-zinc-600">
                  Write your code and press Run
                </span>
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentTab({ exercise }: { exercise: ExamExercise }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
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
        {exercise.testCases.length} test cases · {exercise.type} exercise
      </div>
    </div>
  );
}

function TipsTab({ exercise }: { exercise: ExamExercise }) {
  return (
    <div className="text-sm text-muted-foreground space-y-3">
      <p>
        <strong className="text-foreground">What you&apos;re learning:</strong>{" "}
        {exercise.type === "function"
          ? "Implement a C function that solves a specific problem."
          : "Write a complete C program that takes input and produces output."}
      </p>
      <p>
        <strong className="text-foreground">How to approach:</strong> Read the
        description carefully. Understand what inputs your code receives and what
        output is expected. Write small, testable pieces. Use the Run button to
        test your code.
      </p>
      <p>
        <strong className="text-foreground">Watch out for:</strong> Edge cases,
        memory leaks, incorrect types, and off-by-one errors. Check the allowed
        functions — you can only use what&apos;s listed.
      </p>
      <p className="text-[11px] text-muted-foreground/60 border-t pt-2">
        In the real exam, no tips are available. Practice without them when
        ready.
      </p>
    </div>
  );
}
