"use client";

import { modules } from "@/lib/modules";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, ProgressBar } from "@heroui/react";
import {
  ChevronRight, ChevronLeft, Play, RotateCcw,
  PanelBottomClose, PanelBottomOpen,
  BookOpen, Lightbulb, CheckCircle2, Circle, Keyboard,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import CodeEditor from "@/components/CodeEditor";
import { saveModuleProgress } from "@/lib/db";
import { ExplanationPanel, buildExplanationPrompt, parseChatStream } from "@/components/ExplanationPanel";

export default function ExercisePage() {
  const params = useParams<{ module: string; exercise: string }>();
  const mod = modules[params.module as keyof typeof modules];
  if (!mod) notFound();
  const exIdx = mod.exercises.findIndex((e: { id: string }) => e.id === params.exercise);
  if (exIdx === -1) notFound();
  // Remount on exercise change (Next/Prev navigation doesn't reload the
  // page) so all local state — code, run output, AI verdict, explanation —
  // starts fresh instead of carrying over from the previous exercise.
  return <ExercisePageInner key={`${mod.id}:${exIdx}`} mod={mod} exerciseIndex={exIdx} />;
}

function ExercisePageInner({
  mod,
  exerciseIndex,
}: {
  mod: typeof modules[keyof typeof modules];
  exerciseIndex: number;
}) {
  const ex = mod.exercises[exerciseIndex];
  const router = useRouter();
  const progressKey = `progress:${mod.id}:${ex.id}`;
  const codeKey = `code:${mod.id}:${ex.id}`;
  const cacheKey = `explanation:v8:${mod.id}:${ex.id}`;

  const [code, setCode] = useState(() => (typeof window !== "undefined" && localStorage.getItem(codeKey)) || "");
  const [output, setOutput] = useState("");
  const [verdict, setVerdict] = useState("");
  const [running, setRunning] = useState(false);
  const [isDone, setIsDone] = useState(() => typeof window !== "undefined" && localStorage.getItem(progressKey) === "done");
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(() => {
    if (typeof window === "undefined") return 220;
    const sh = localStorage.getItem("console-height");
    return sh ? parseInt(sh, 10) : 220;
  });
  const [leftTab, setLeftTab] = useState<"exercise" | "explanation">("exercise");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);
  const resizingRef = useRef(false);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    if (output && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const explanationPrompt = buildExplanationPrompt({
    context: `Module: ${mod.title}`,
    title: ex.title,
    description: ex.description,
    prototype: "prototype" in ex ? (ex.prototype as string) : undefined,
    allowed: "allowed" in ex ? (ex.allowed as string[]) : undefined,
  });

  const handleRun = useCallback(async () => {
    const c = codeRef.current;
    if (!c.trim()) { setOutput(""); setConsoleOpen(true); return; }
    setRunning(true); setConsoleOpen(true); setVerdict(""); setOutput("");

    try {
      const res = await fetch("/api/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, exerciseId: ex.id, moduleId: mod.id }),
      });
      const data = await res.json();
      setOutput(data.output || data.error || "(no output)");
    } catch { setOutput("Execution failed"); }

    try {
      const aiRes = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: verdictPrompt(mod.title, ex.title, ex.description, mod.type, c, ex) }] }),
      });
      const t = await aiRes.text();
      setVerdict(parseChatStream(t));
    } catch { setVerdict(""); }

    setRunning(false);
  }, [ex.id, mod.id, mod.title, ex.title, ex.description, mod.type]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight" && exerciseIndex < mod.exercises.length - 1) {
        e.preventDefault(); router.push(`/${mod.id}/${mod.exercises[exerciseIndex + 1].id}`);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft" && exerciseIndex > 0) {
        e.preventDefault(); router.push(`/${mod.id}/${mod.exercises[exerciseIndex - 1].id}`);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") { e.preventDefault(); setConsoleOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRun, exerciseIndex, mod.id, mod.exercises, router]);

  const prevEx = exerciseIndex > 0 ? mod.exercises[exerciseIndex - 1] : null;
  const nextEx = exerciseIndex < mod.exercises.length - 1 ? mod.exercises[exerciseIndex + 1] : null;
  const pct = mod.exercises.length > 0 ? Math.round(((exerciseIndex + 1) / mod.exercises.length) * 100) : 0;

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); resizingRef.current = true;
    const startY = e.clientY, startH = consoleHeight;
    const mm = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const h = Math.max(100, Math.min(500, startH + (startY - ev.clientY)));
      setConsoleHeight(h); localStorage.setItem("console-height", String(h));
    };
    const mu = () => { resizingRef.current = false; document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); };
    document.addEventListener("mousemove", mm); document.addEventListener("mouseup", mu);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="border-b px-4 flex items-center gap-3 flex-shrink-0 bg-background" style={{ height: 38 }}>
        <Link href={`/${mod.id}`} className="text-xs text-muted-foreground hover:text-foreground no-underline flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" /> {mod.title}
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-sm font-semibold">{ex.title}</span>
        <span className="text-[11px] text-muted-foreground">Ex {String(ex.number).padStart(2, "0")}</span>
        {isDone && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Done</span>}

        <div className="flex-1" />

        <ProgressBar value={pct} size="sm" className="w-20 hidden sm:block" color="accent" />
        <span className="text-[10px] text-muted-foreground tabular-nums hidden sm:inline">
          {exerciseIndex + 1}/{mod.exercises.length}
        </span>

        <div className="flex items-center">
          <Button isIconOnly variant="ghost" size="sm" isDisabled={!prevEx}
            onPress={() => prevEx && router.push(`/${mod.id}/${prevEx.id}`)} aria-label="Previous"
            className="hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button isIconOnly variant="ghost" size="sm" isDisabled={!nextEx}
            onPress={() => nextEx && router.push(`/${mod.id}/${nextEx.id}`)} aria-label="Next"
            className="hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex lg:flex-row overflow-hidden min-h-0">
        {/* Left panel */}
        <div className="lg:w-[340px] border-r flex flex-col flex-shrink-0 overflow-hidden min-h-0">
          <div className="flex border-b bg-muted/30 flex-shrink-0" style={{ height: 40 }}>
            <TabButton active={leftTab === "exercise"} onClick={() => setLeftTab("exercise")} icon={<BookOpen className="h-3.5 w-3.5" />} label="Exercise" />
            <TabButton active={leftTab === "explanation"} onClick={() => setLeftTab("explanation")} icon={<Lightbulb className="h-3.5 w-3.5" />} label="Explanation" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin min-h-0">
            {leftTab === "exercise" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{ex.description}</p>

                {"prototype" in ex && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <Label>Prototype</Label>
                    <code className="text-sm font-mono text-foreground">{ex.prototype}</code>
                  </div>
                )}

                {"allowed" in ex && ex.allowed && ex.allowed.length > 0 && (
                  <div>
                    <Label>Allowed functions</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {ex.allowed.map((fn: string) => (
                        <span key={fn} className="text-xs px-2 py-0.5 rounded-md bg-muted font-mono text-muted-foreground border">{fn}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Turn-in files</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {ex.files.map((f: string) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-md bg-muted/50 font-mono text-muted-foreground">{f}</span>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground/60 border-t pt-3">
                  Compiled with {mod.type === "shell" ? "/bin/sh" : "gcc"}.
                  {mod.type === "c" && " Submit only the required function."}
                </div>
              </div>
            ) : (
              <ExplanationPanel cacheKey={cacheKey} prompt={explanationPrompt} />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {/* Toolbar */}
          <div className="border-b px-3 flex items-center gap-2 bg-muted/30 flex-shrink-0" style={{ height: 40 }}>
            <Button
              variant="primary"
              size="sm"
              onPress={handleRun}
              isDisabled={running}
              className="font-semibold shadow-sm hover:shadow-md transition-shadow"
            >
              {running ? <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {running ? "Running" : "Run"}
            </Button>
            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
              Ctrl+Enter
            </span>
            <div className="flex-1" />

            <button
              onClick={() => { const s = !isDone; setIsDone(s); localStorage.setItem(progressKey, s ? "done" : ""); saveModuleProgress(mod.id, ex.id, s ? "done" : "", codeRef.current).catch(() => {}); }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isDone
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              {isDone ? "Done" : "Mark done"}
            </button>

            <Button isIconOnly variant="ghost" size="sm" onPress={() => setShowShortcuts(!showShortcuts)}
              aria-label="Shortcuts"
              className="hover:bg-muted transition-colors">
              <Keyboard className="h-3.5 w-3.5" />
            </Button>
            <Button isIconOnly variant="ghost" size="sm" onPress={() => setConsoleOpen(!consoleOpen)}
              aria-label={consoleOpen ? "Hide console" : "Show console"}
              className="hover:bg-muted transition-colors">
              {consoleOpen ? <PanelBottomClose className="h-4 w-4" /> : <PanelBottomOpen className="h-4 w-4" />}
            </Button>
          </div>

          {showShortcuts && (
            <div className="absolute top-10 right-3 z-50 bg-background border rounded-xl shadow-xl p-4 text-xs w-56" onClick={() => setShowShortcuts(false)}>
              <div className="font-semibold mb-2 text-sm">Keyboard shortcuts</div>
              <div className="space-y-2">
                <Shortcut keys="Ctrl Enter" label="Run code" />
                <Shortcut keys="Ctrl →" label="Next exercise" />
                <Shortcut keys="Ctrl ←" label="Previous exercise" />
                <Shortcut keys="Ctrl J" label="Toggle console" />
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 relative bg-white dark:bg-[#1e1e1e] min-h-[120px]">
            <CodeEditor value={code} onChange={(v) => { const val = v || ""; setCode(val); localStorage.setItem(codeKey, val); }}
              language={mod.type === "shell" ? "shell" : "c"} />
          </div>

          {/* Resizer */}
          {consoleOpen && (
            <div className="h-1.5 bg-border hover:bg-primary/30 cursor-ns-resize flex-shrink-0 flex items-center justify-center group"
              onMouseDown={onResizeMouseDown}>
              <div className="w-10 h-0.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors" />
            </div>
          )}

          {/* Console */}
          {consoleOpen && (
            <div className="flex-shrink-0 border-t bg-white dark:bg-zinc-950" style={{ height: consoleHeight }}>
              <div className="px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Output</span>
                {running && <span className="text-[10px] text-amber-600 dark:text-amber-400 animate-pulse">running...</span>}
                <div className="flex-1" />
                {verdict && (
                  <span className={`text-[11px] truncate max-w-[60%] ${verdict.trim().startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {verdict}
                  </span>
                )}
              </div>
              <pre ref={outputRef}
                className="p-3 font-mono text-[13px] leading-relaxed overflow-y-auto scrollbar-thin whitespace-pre-wrap break-all"
                style={{ height: consoleHeight - 33 }}>
                {verdict && (
                  <div className={`mb-2 pb-2 border-b border-zinc-200 dark:border-zinc-800 font-sans text-xs font-medium ${verdict.trim().startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {verdict}
                  </div>
                )}
                {output || (
                  <span className="text-zinc-400 dark:text-zinc-600">{"// Write code and press Run or Ctrl+Enter"}</span>
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 h-full text-xs font-medium transition-all ${
        active
          ? "text-foreground border-b-2 border-primary bg-background"
          : "text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:bg-muted/50"
      }`}>
      {icon} {label}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{children}</p>;
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex justify-between items-center">
      <span>{label}</span>
      <kbd className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[10px] border">{keys}</kbd>
    </div>
  );
}

function verdictPrompt(module: string, exercise: string, description: string, type: string, code: string, ex: Record<string, unknown>) {
  const proto = "prototype" in ex ? `Prototype: ${ex.prototype}` : "";
  return `Exercise: ${module} - ${exercise}
Description: ${description}
${proto ? `Prototype: ${proto}` : ""}
Student code:
\`\`\`${type === "shell" ? "sh" : "c"}
${code}
\`\`\`

Evaluate if this code correctly implements the exercise. Reply with EXACTLY ONE LINE: start with ✅ if correct or ❌ if not, then a short reason (max 15 words). No extra text.`;
}
