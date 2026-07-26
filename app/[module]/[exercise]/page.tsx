"use client";

import { modules } from "@/lib/modules";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Badge } from "@heroui/react";
import {
  ChevronRight, ChevronLeft, Play, RotateCcw,
  PanelBottomOpen, PanelBottomClose, ArrowLeft,
  ArrowRight, ArrowUp, BookOpen, Lightbulb,
  CheckCircle2, Circle, Keyboard,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import CodeEditor from "@/components/CodeEditor";

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
  const router = useRouter();
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [verdict, setVerdict] = useState("");
  const [running, setRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(220);
  const [leftTab, setLeftTab] = useState<"exercise" | "explanation">("exercise");
  const [explanation, setExplanation] = useState("");
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);
  const resizingRef = useRef(false);
  const codeRef = useRef(code);
  const [showShortcuts, setShowShortcuts] = useState(false);
  codeRef.current = code;

  const progressKey = `progress:${mod.id}:${ex.id}`;
  const codeKey = `code:${mod.id}:${ex.id}`;
  const cacheKey = `explanation:v2:${mod.id}:${ex.id}`;

  useEffect(() => {
    const savedCode = localStorage.getItem(codeKey);
    if (savedCode) setCode(savedCode);
    setIsDone(localStorage.getItem(progressKey) === "done");
    const sh = localStorage.getItem("console-height");
    if (sh) setConsoleHeight(parseInt(sh, 10));
  }, [codeKey, progressKey]);

  useEffect(() => {
    if (output && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  useEffect(() => {
    setExplanation("");
    setLoadingExplanation(true);
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setExplanation(cached); setLoadingExplanation(false); return; }

    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{
              role: "user",
              content: `You are teaching complete beginners at the 42 School C Piscine. They barely know C. Be extremely simple, direct, and practical. No fluff. Use short sentences. Avoid jargon or explain it immediately.

Module: ${mod.title}
Exercise: ${ex.title}
Description: ${ex.description}
${"prototype" in ex ? `Prototype: ${ex.prototype}` : ""}
${"allowed" in ex && ex.allowed ? `Allowed: ${ex.allowed.join(", ")}` : ""}

Reply in this exact format (plain text):

WHAT YOU'RE LEARNING:
(1-2 very short sentences — what skill this exercise builds)

HOW TO DO IT:
(numbered steps — the exact things to write, in order.
1. Include <unistd.h> at the top
2. Write the function with the given prototype
3. Use write(1, &c, 1) to output the char
Keep each step one line, very short.)

KEY RULES:
- rule 1 (something you MUST do)
- rule 2 (something you MUST NOT do)
- max 3 rules, each one line only

WATCH OUT FOR:
- mistake 1 (most common error beginners make)
- mistake 2
- max 3, each one line only`,
            }],
          }),
        });
        const text = await res.text();
        const parts = text.split("\n").filter(l => l.startsWith("0:"));
        const content = parts.map(l => { try { return JSON.parse(l.slice(2)); } catch { return ""; } }).join("");
        setExplanation(content);
        localStorage.setItem(cacheKey, content);
      } catch { setExplanation("Failed to load."); }
      setLoadingExplanation(false);
    })();
  }, [mod.id, mod.title, ex.id, ex.title, ex.description]);

  const handleRun = useCallback(async () => {
    const c = codeRef.current;
    if (!c.trim()) { setOutput("// Write code first, then Run"); setConsoleOpen(true); return; }
    setRunning(true); setConsoleOpen(true); setVerdict(""); setOutput("");

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, exerciseId: ex.id, moduleId: mod.id }),
      });
      const data = await res.json();
      setOutput(data.output || data.error || "(no output)");
    } catch { setOutput("Failed to execute"); }

    try {
      const aiRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Exercise: ${mod.title} - ${ex.title}\nDescription: ${ex.description}\n${"prototype" in ex ? `Prototype: ${ex.prototype}\n` : ""}Student code:\n\`\`\`${mod.type === "shell" ? "sh" : "c"}\n${c}\n\`\`\`\n\nEvaluate if code is correct. ONE LINE: ✅ or ❌ then short reason max 15 words.`,
          }],
        }),
      });
      const t = await aiRes.text();
      const parts = t.split("\n").filter(l => l.startsWith("0:"));
      setVerdict(parts.map(l => { try { return JSON.parse(l.slice(2)); } catch { return ""; } }).join(""));
    } catch { setVerdict(""); }

    setRunning(false);
  }, [ex.id, mod.id, mod.title, ex.title, ex.description, mod.type]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight" && exerciseIndex < mod.exercises.length - 1) {
        e.preventDefault();
        router.push(`/${mod.id}/${mod.exercises[exerciseIndex + 1].id}`);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft" && exerciseIndex > 0) {
        e.preventDefault();
        router.push(`/${mod.id}/${mod.exercises[exerciseIndex - 1].id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRun, exerciseIndex, mod.id, mod.exercises, router]);

  const prevEx = exerciseIndex > 0 ? mod.exercises[exerciseIndex - 1] : null;
  const nextEx = exerciseIndex < mod.exercises.length - 1 ? mod.exercises[exerciseIndex + 1] : null;

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
      <div className="border-b px-3 py-1.5 flex items-center gap-2 flex-shrink-0 bg-background">
        <Link href={`/${mod.id}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline">
          <ArrowLeft className="h-3.5 w-3.5" /> {mod.title}
        </Link>
        <span className="text-muted-foreground text-xs">/</span>
        <span className="text-xs font-medium">Ex{String(ex.number).padStart(2, "0")}: {ex.title}</span>
        {isDone && <Badge variant="soft" color="success" size="sm">Done</Badge>}
        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <Button isIconOnly variant="ghost" size="sm" isDisabled={!prevEx}
            onPress={() => prevEx && router.push(`/${mod.id}/${prevEx.id}`)}
            aria-label="Previous exercise">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[11px] text-muted-foreground tabular-nums px-1">
            {exerciseIndex + 1}/{mod.exercises.length}
          </span>
          <Button isIconOnly variant="ghost" size="sm" isDisabled={!nextEx}
            onPress={() => nextEx && router.push(`/${mod.id}/${nextEx.id}`)}
            aria-label="Next exercise">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex lg:flex-row overflow-hidden min-h-0">
        {/* Left panel */}
        <div className="lg:w-[350px] xl:w-[380px] border-r flex flex-col flex-shrink-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b bg-muted/30 flex-shrink-0">
            <button
              onClick={() => setLeftTab("exercise")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                leftTab === "exercise" ? "text-foreground border-b-2 border-primary bg-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> Exercise
            </button>
            <button
              onClick={() => setLeftTab("explanation")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                leftTab === "explanation" ? "text-foreground border-b-2 border-primary bg-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" /> Explanation
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {leftTab === "exercise" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold">{ex.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{ex.description}</p>
                </div>

                {"prototype" in ex && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prototype</p>
                    <code className="text-sm font-mono">{ex.prototype}</code>
                  </div>
                )}

                {"allowed" in ex && ex.allowed && ex.allowed.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Allowed</p>
                    <div className="flex flex-wrap gap-1">
                      {ex.allowed.map((fn: string) => (
                        <code key={fn} className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">{fn}</code>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Files</p>
                  <div className="flex flex-wrap gap-1">
                    {ex.files.map((f: string) => (
                      <code key={f} className="text-xs px-1.5 py-0.5 rounded border font-mono">{f}</code>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
                  Compiled with {mod.type === "shell" ? "/bin/sh" : "gcc"}.
                  {mod.type === "c" && " Write only the required function."}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-base font-bold mb-3">{ex.title}</h2>
                {loadingExplanation ? (
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                    <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                  </div>
                ) : (
                  <Explanation text={explanation || "Generating..."} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {/* Toolbar */}
          <div className="border-b px-3 py-1.5 flex items-center gap-3 bg-muted/30 flex-shrink-0">
            <Button variant="primary" size="sm" onPress={handleRun} isDisabled={running}>
              {running ? <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {running ? "Running..." : "Run"}
            </Button>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {mod.type === "shell" ? "bash" : "gcc"}
            </span>
            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline border-l border-border pl-2 ml-1">
              Ctrl+Enter
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onPress={() => { setIsDone(!isDone); localStorage.setItem(progressKey, isDone ? "" : "done"); }}>
              {isDone ? <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 mr-1" />}
              {isDone ? "Done" : "Mark done"}
            </Button>
            <Button isIconOnly variant="ghost" size="sm" onPress={() => setShowShortcuts(!showShortcuts)}
              aria-label="Keyboard shortcuts">
              <Keyboard className="h-3.5 w-3.5" />
            </Button>
            <Button isIconOnly variant="ghost" size="sm" onPress={() => setConsoleOpen(!consoleOpen)}
              aria-label={consoleOpen ? "Close console" : "Open console"}>
              {consoleOpen ? <PanelBottomClose className="h-4 w-4" /> : <PanelBottomOpen className="h-4 w-4" />}
            </Button>
          </div>

          {showShortcuts && (
            <div className="absolute top-9 right-3 z-40 bg-background border rounded-lg shadow-xl p-3 text-xs w-52">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Shortcuts</span>
                <button onClick={() => setShowShortcuts(false)} className="text-muted-foreground hover:text-foreground">×</button>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span>Run code</span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl Enter</kbd></div>
                <div className="flex justify-between"><span>Next exercise</span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl →</kbd></div>
                <div className="flex justify-between"><span>Prev exercise</span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl ←</kbd></div>
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 relative bg-[#1e1e1e] min-h-[150px]">
            <CodeEditor value={code} onChange={(v) => { const val = v || ""; setCode(val); localStorage.setItem(codeKey, val); }}
              language={mod.type === "shell" ? "shell" : "c"} />
          </div>

          {/* Resizer */}
          {consoleOpen && (
            <div className="h-1.5 bg-border hover:bg-primary/30 cursor-ns-resize flex-shrink-0 flex items-center justify-center group"
              onMouseDown={onResizeMouseDown}>
              <div className="w-8 h-0.5 rounded bg-muted-foreground/20 group-hover:bg-primary/60 transition-colors" />
            </div>
          )}

          {/* Console */}
          {consoleOpen && (
            <div className="flex-shrink-0 border-t bg-zinc-950" style={{ height: consoleHeight }}>
              <div className="px-3 py-1 border-b border-zinc-800 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Output</span>
                {running && <span className="text-[10px] text-amber-400 animate-pulse">running...</span>}
                {verdict && (
                  <span className={`text-[11px] ml-auto truncate ${verdict.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>
                    {verdict}
                  </span>
                )}
              </div>
              <pre ref={outputRef}
                className="p-3 font-mono text-[13px] leading-relaxed overflow-y-auto scrollbar-thin whitespace-pre-wrap break-all"
                style={{ height: consoleHeight - 28 }}>
                {verdict && (
                  <div className={`mb-2 pb-2 border-b border-zinc-800 font-sans text-xs ${verdict.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>
                    {verdict}
                  </div>
                )}
                {output || (
                  <span className="text-zinc-600">
                    {mod.type === "shell" ? "# shell script → Run" : "// C code → Run (Ctrl+Enter)"}
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

function Explanation({ text }: { text: string }) {
  const lines = text.split("\n");
  const els: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^(WHAT YOU'RE LEARNING|HOW TO DO IT|KEY RULES|WATCH OUT FOR):?$/i.test(line.trim())) {
      els.push(<h4 key={i} className="text-xs font-bold text-foreground mt-4 mb-1.5 tracking-wide uppercase">{line.trim().replace(/:$/, "")}</h4>);
      i++;
    } else if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) { items.push(lines[i].trim().slice(2)); i++; }
      els.push(<ul key={i} className="space-y-1 ml-0.5">{items.map((it, j) => (
        <li key={j} className="text-[13px] text-muted-foreground leading-relaxed flex gap-2">
          <span className="text-primary/50 mt-0.5 flex-shrink-0">•</span><span>{it}</span>
        </li>
      ))}</ul>);
    } else if (line.trim()) {
      els.push(<p key={i} className="text-[13px] text-muted-foreground leading-relaxed">{line.trim()}</p>);
      i++;
    } else { i++; }
  }
  return <div>{els}</div>;
}
