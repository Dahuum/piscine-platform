"use client";

import { modules } from "@/lib/modules";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Badge } from "@heroui/react";
import { ChevronRight, ChevronLeft, Play, RotateCcw, PanelBottomOpen, PanelBottomClose } from "lucide-react";
import { useEffect, useState, useRef, lazy, Suspense } from "react";
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
  const [verdict, setVerdict] = useState("");
  const [running, setRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(200);
  const outputRef = useRef<HTMLPreElement>(null);
  const resizingRef = useRef(false);

  const progressKey = `progress:${mod.id}:${ex.id}`;
  const codeKey = `code:${mod.id}:${ex.id}`;

  useEffect(() => {
    const savedCode = localStorage.getItem(codeKey);
    if (savedCode) setCode(savedCode);
    setIsDone(localStorage.getItem(progressKey) === "done");
    const savedHeight = localStorage.getItem(`console-height`);
    if (savedHeight) setConsoleHeight(parseInt(savedHeight, 10));
  }, [codeKey, progressKey]);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const codeRef = useRef(code);
  codeRef.current = code;

  const handleRun = async () => {
    const currentCode = codeRef.current;
    if (!currentCode.trim()) {
      setOutput("// Write some code first, then click Run");
      setConsoleOpen(true);
      return;
    }
    setRunning(true);
    setConsoleOpen(true);
    setVerdict("");
    setOutput("Running...");
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: currentCode, exerciseId: ex.id, moduleId: mod.id }),
      });
      const data = await res.json();
      setOutput(data.output || data.error || "(no output)");
    } catch {
      setOutput("Failed to execute code");
    }

    try {
      const aiRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Exercise: ${mod.title} - ${ex.title}\nDescription: ${ex.description}\n${"prototype" in ex ? `Prototype: ${ex.prototype}\n` : ""}Student code:\n\`\`\`${mod.type === "shell" ? "sh" : "c"}\n${currentCode}\n\`\`\`\n\nEvaluate if this code correctly implements the exercise. Reply with EXACTLY ONE LINE: start with ✅ if correct or ❌ if not, then a short reason (max 15 words). No extra text.`,
            },
          ],
        }),
      });
      const aiData = await aiRes.json();
      setVerdict(aiData.text || "");
    } catch {
      setVerdict("");
    }

    setRunning(false);
  };

  const handleCodeChange = (value: string | undefined) => {
    const v = value || "";
    setCode(v);
    localStorage.setItem(codeKey, v);
  };

  const handleMarkDone = () => {
    const newState = !isDone;
    setIsDone(newState);
    localStorage.setItem(progressKey, newState ? "done" : "");
  };

  const prevEx = exerciseIndex > 0 ? mod.exercises[exerciseIndex - 1] : null;
  const nextEx = exerciseIndex < mod.exercises.length - 1 ? mod.exercises[exerciseIndex + 1] : null;

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startY = e.clientY;
    const startHeight = consoleHeight;

    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const newHeight = Math.max(80, Math.min(600, startHeight + (startY - e.clientY)));
      setConsoleHeight(newHeight);
      localStorage.setItem("console-height", String(newHeight));
    };

    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="border-b px-4 py-2 flex items-center gap-4 text-sm flex-wrap bg-background flex-shrink-0">
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

      <div className="flex-1 flex lg:flex-row overflow-hidden min-h-0">
        {/* Left panel: Instructions */}
        <div className="lg:w-[340px] xl:w-[380px] border-r overflow-y-auto p-4 sm:p-5 scrollbar-thin flex-shrink-0">
          <h2 className="text-lg font-bold mb-3">
            Exercise {String(ex.number).padStart(2, "0")}: {ex.title}
          </h2>

          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{ex.description}</p>

          {"prototype" in ex && (
            <div className="mb-4 p-3 rounded-lg bg-muted">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prototype</p>
              <code className="text-sm font-mono break-all">{ex.prototype}</code>
            </div>
          )}

          {"allowed" in ex && ex.allowed && ex.allowed.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Allowed Functions</p>
              <div className="flex flex-wrap gap-1">
                {ex.allowed.map((fn: string) => (
                  <code key={fn} className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                    {fn}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Files to Submit</p>
            <div className="flex flex-wrap gap-1">
              {ex.files.map((f: string) => (
                <code key={f} className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                  {f}
                </code>
              ))}
            </div>
          </div>

          <Card className="p-3 bg-muted/50">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {mod.type === "shell"
                ? "Shell scripts must be executable with /bin/sh. Use chmod to set permissions."
                : "Your code will be compiled with gcc and executed.\n\nWrite the function as specified. The test main() will be added automatically for execution."}
            </p>
          </Card>

          <div className="flex gap-2 mt-5">
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

        {/* Right panel: Editor + Console */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Toolbar */}
          <div className="border-b px-4 py-1.5 flex items-center gap-2 bg-muted/30 flex-shrink-0">
            <Button
              variant="primary"
              size="sm"
              onPress={handleRun}
              isDisabled={running}
            >
              {running ? <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              {running ? "Running..." : "Run"}
            </Button>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              {mod.type === "shell" ? "/bin/sh" : "gcc"}
            </span>
            <div className="flex-1" />
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              onPress={() => setConsoleOpen(!consoleOpen)}
              aria-label={consoleOpen ? "Close console" : "Open console"}
            >
              {consoleOpen ? <PanelBottomClose className="h-4 w-4" /> : <PanelBottomOpen className="h-4 w-4" />}
            </Button>
          </div>

          {/* Editor */}
          <div className="flex-1 relative bg-[#1e1e1e] min-h-[200px]">
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                language={mod.type === "shell" ? "shell" : "c"}
              />
            </Suspense>
          </div>

          {/* Resizer handle */}
          {consoleOpen && (
            <div
              className="h-1.5 bg-border hover:bg-primary/40 cursor-ns-resize flex-shrink-0 transition-colors flex items-center justify-center group"
              onMouseDown={onResizeMouseDown}
            >
              <div className="w-8 h-0.5 rounded bg-muted-foreground/30 group-hover:bg-primary/60 transition-colors" />
            </div>
          )}

          {/* Console */}
          {consoleOpen && (
            <div className="flex-shrink-0 border-t bg-zinc-950 text-zinc-100" style={{ height: consoleHeight }}>
              <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Console</span>
                {running && (
                  <span className="text-[10px] text-amber-400 animate-pulse">executing...</span>
                )}
                {verdict && (
                  <span className={`text-[11px] ml-2 truncate ${verdict.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>
                    {verdict}
                  </span>
                )}
              </div>
              <pre
                ref={outputRef}
                className="p-3 font-mono text-[13px] leading-relaxed overflow-y-auto scrollbar-thin whitespace-pre-wrap break-all"
                style={{ height: consoleHeight - 34 }}
              >
                {output || (
                  <span className="text-zinc-600">
                    {mod.type === "shell"
                      ? "# Write a shell script and click Run to execute"
                      : "// Write your C code and click Run to compile & execute"}
                  </span>
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
