"use client";

import { modules } from "@/lib/modules";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Badge } from "@heroui/react";
import { ChevronRight, ChevronLeft, Play, RotateCcw } from "lucide-react";
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Skeleton } from "@heroui/react";

const CodeEditor = lazy(() => import("@/components/CodeEditor"));

export default function ExercisePage() {
  const params = useParams<{ module: string; exercise: string }>();
  const mod = modules[params.module as keyof typeof modules];

  if (!mod) notFound();

  const exIdx = mod.exercises.findIndex((e: { id: string }) => e.id === params.exercise);
  if (exIdx === -1) notFound();

  return <ExercisePageInner mod={mod} exerciseIndex={exIdx} />;
}

function ExercisePageInner({
  mod,
  exerciseIndex,
}: {
  mod: typeof modules[keyof typeof modules];
  exerciseIndex: number;
}) {
  const ex = mod.exercises[exerciseIndex];
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const progressKey = `progress:${mod.id}:${ex.id}`;
  const codeKey = `code:${mod.id}:${ex.id}`;

  useEffect(() => {
    const savedCode = localStorage.getItem(codeKey);
    if (savedCode) setCode(savedCode);
    setIsDone(localStorage.getItem(progressKey) === "done");
  }, [codeKey, progressKey]);

  const handleRun = useCallback(async () => {
    if (!code.trim()) return;
    setRunning(true);
    setOutput("");
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, exerciseId: ex.id, moduleId: mod.id }),
      });
      const data = await res.json();
      setOutput(data.output || data.error || "No output");
    } catch (e: unknown) {
      setOutput("Failed to execute code");
    }
    setRunning(false);
  }, [code, ex.id, mod.id]);

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      const v = value || "";
      setCode(v);
      localStorage.setItem(codeKey, v);
    },
    [codeKey],
  );

  const handleMarkDone = () => {
    const newState = !isDone;
    setIsDone(newState);
    localStorage.setItem(progressKey, newState ? "done" : "");
  };

  const prevEx = exerciseIndex > 0 ? mod.exercises[exerciseIndex - 1] : null;
  const nextEx = exerciseIndex < mod.exercises.length - 1 ? mod.exercises[exerciseIndex + 1] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b px-4 py-2 flex items-center gap-4 text-sm flex-wrap bg-background">
        <Link href={`/${mod.id}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground no-underline">
          <ChevronLeft className="h-4 w-4" />
          {mod.title}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">
          Ex{String(ex.number).padStart(2, "0")}: {ex.title}
        </span>
        {isDone && <Badge variant="soft" color="success" size="sm">Completed</Badge>}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onPress={handleMarkDone}>
          {isDone ? "Undo Complete" : "Mark Done"}
        </Button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Instructions */}
        <div className="lg:w-2/5 xl:w-1/3 border-r overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          <h2 className="text-xl font-bold mb-4">
            Exercise {String(ex.number).padStart(2, "0")}: {ex.title}
          </h2>

          <p className="text-muted-foreground mb-6">{ex.description}</p>

          {"prototype" in ex && (
            <div className="mb-6 p-3 rounded-lg bg-muted">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Prototype</p>
              <code className="text-sm font-mono">{ex.prototype}</code>
            </div>
          )}

          {"allowed" in ex && ex.allowed && ex.allowed.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Allowed Functions</p>
              <div className="flex flex-wrap gap-1">
                {ex.allowed.map((fn: string) => (
                  <code key={fn} className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                    {fn}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Files to Submit</p>
            <div className="flex flex-wrap gap-1">
              {ex.files.map((f: string) => (
                <code key={f} className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                  {f}
                </code>
              ))}
            </div>
          </div>

          <Card className="p-4 bg-muted/50">
            <h3 className="font-semibold text-sm mb-2">Key Concepts</h3>
            <p className="text-xs text-muted-foreground">
              {mod.type === "shell"
                ? "Shell scripts must be executable with /bin/sh. Use chmod to set permissions."
                : "Compile with: cc -Wall -Wextra -Werror. Moulinette is strict. No forbidden functions."}
            </p>
          </Card>

          <div className="flex gap-2 mt-6">
            {prevEx ? (
              <Link
                href={`/${mod.id}/${prevEx.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline"
              >
                <ChevronLeft className="h-4 w-4" />
                {prevEx.title}
              </Link>
            ) : (
              <Link
                href={`/${mod.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Link>
            )}
            <div className="flex-1" />
            {nextEx && (
              <Link
                href={`/${mod.id}/${nextEx.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors no-underline"
              >
                {nextEx.title}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Right: Code Editor + Output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative bg-[#1e1e1e]">
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                language={mod.type === "shell" ? "shell" : "c"}
              />
            </Suspense>
          </div>

          <div className="border-t px-4 py-2 flex items-center gap-2 bg-muted/30">
              <Button
                variant="primary"
                size="sm"
                onPress={handleRun}
                isDisabled={running || !code.trim()}
              >
                {running ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ml-1.5">{running ? "Running..." : "Run"}</span>
              </Button>
            <span className="text-xs text-muted-foreground">
              {mod.type === "shell" ? "Executes with /bin/sh" : "Compiles with cc -Wall -Wextra -Werror"}
            </span>
          </div>

          {output && (
            <div className="border-t">
              <div className="px-4 py-2 border-b bg-muted/50">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Output</span>
              </div>
              <pre className="p-4 font-mono text-sm max-h-48 overflow-y-auto whitespace-pre-wrap scrollbar-thin">
                {output}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
