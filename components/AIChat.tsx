"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { Send, Bot, User, X, MessageSquare, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { examWeeks } from "@/lib/exam-data";
import type { ExamWeek } from "@/lib/exam-data";

type Message = { id: string; role: "user" | "assistant"; content: string };

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_: string, _lang: string, code: string) => {
    const escaped = code.trimEnd();
    return `<pre class="p-3 rounded-lg bg-black/10 dark:bg-white/5 overflow-x-auto text-xs font-mono my-2"><code>${escaped}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs font-mono">$1</code>');

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  html = html.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-base mt-3 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-3 mb-1">$1</h1>');

  html = html.replace(/^- (.+)$/gm, '<li class="ml-3 list-disc text-sm">$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-3 list-decimal text-sm">$2</li>');

  html = html.replace(/\n\n/g, "</p><p class='mb-2 last:mb-0 text-sm'>");
  html = "<p class='mb-2 last:mb-0 text-sm'>" + html + "</p>";
  html = html.replace(/<p class='mb-2 last:mb-0 text-sm'><\/p>/g, "");

  return html;
}

let msgCounter = 0;
function newId() { return `msg-${++msgCounter}-${Date.now()}`; }

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content: "Hello! I'm your 42 Piscine teaching assistant. I can help you understand C concepts, debug your code, and guide you through exercises. What are you working on?",
};

function describeWeek(week: ExamWeek): string {
  return `${week.title} (id: ${week.id}): ${week.levelCount} levels (0 through ${week.levelCount - 1}), ${week.gradePerLevel} points per level (${week.gradePerLevel * week.levelCount} points total), ${week.timeMinutes} minute time limit. A wrong submission triggers an increasing cooldown before the next attempt. One random exercise is drawn per level.`;
}

// Builds the facts the assistant should use instead of guessing, based on
// which exam page (if any) the student is currently on. Returns null off
// exam pages so the system prompt isn't padded with irrelevant context.
function buildExamContext(pathname: string | null): string | null {
  if (!pathname) return null;
  const weekMatch = pathname.match(/^\/exam\/week\/([^/]+)/);
  if (weekMatch) {
    const week = examWeeks[weekMatch[1]];
    return week ? describeWeek(week) : null;
  }
  if (pathname === "/exam" || pathname.startsWith("/exam/")) {
    return Object.values(examWeeks).map(describeWeek).join("\n");
  }
  return null;
}

export default function AIChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // No AI assistance during the actual timed exam — this is a rule the exam
  // itself states ("No AI assistance during the exam"), but nothing
  // previously enforced it: this widget is otherwise rendered globally.
  const isLiveExam = /^\/exam\/week\/[^/]+\/take/.test(pathname || "");
  const examContext = buildExamContext(pathname);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: newId(), role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    const assistantId = newId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          examContext,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              const content = JSON.parse(line.slice(2));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + content } : m,
                ),
              );
            } catch { /* skip */ }
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Failed to connect";
      setError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: m.content || `Error: ${msg}` } : m,
        ),
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (isLiveExam) return null;

  if (!open) {
    return (
      <Button
        isIconOnly
        variant="primary"
        className="fixed bottom-6 right-6 z-50 shadow-lg rounded-full h-12 w-12"
        onPress={() => setOpen(true)}
        aria-label="Open AI assistant"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
    );
  }

  const chatWidth = expanded ? "w-[90vw] sm:w-[700px]" : "w-80 sm:w-96";
  const chatHeight = expanded ? "h-[85vh]" : "h-[28rem]";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${chatWidth} ${chatHeight} shadow-2xl rounded-xl border bg-background flex flex-col overflow-hidden transition-all duration-200`}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4 text-primary" />
          AI Assistant
        </div>
        <div className="flex items-center gap-1">
          <Button isIconOnly variant="ghost" size="sm" onPress={() => setMessages([INITIAL_MESSAGE])} aria-label="Clear chat">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button isIconOnly variant="ghost" size="sm" onPress={() => setExpanded(!expanded)} aria-label={expanded ? "Minimize" : "Maximize"}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button isIconOnly variant="ghost" size="sm" onPress={() => setOpen(false)} aria-label="Close assistant">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="flex-shrink-0 mt-1"><Bot className="h-4 w-4 text-primary" /></div>
            )}
            <div
              className={`px-3 py-2 rounded-lg max-w-[85%] ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {m.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              ) : (
                <div
                  className="text-sm [&_pre]:whitespace-pre-wrap [&_code]:break-all"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              )}
            </div>
            {m.role === "user" && (
              <div className="flex-shrink-0 mt-1"><User className="h-4 w-4 text-muted-foreground" /></div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <Bot className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
            <div className="px-3 py-2 rounded-lg bg-muted flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
              </span>
              <button onClick={stopGenerating} className="text-xs text-muted-foreground hover:text-foreground ml-1">
                Stop
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-xs text-red-500">{error}</div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t p-2 flex items-end gap-2 flex-shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about C, shell, or your code..."
          rows={1}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none font-sans scrollbar-thin placeholder:text-muted-foreground/50"
        />
        <Button isIconOnly size="sm" variant="primary" type="submit" isDisabled={!input.trim() || loading}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
