"use client";

import { useEffect, useState } from "react";

// The chat API streams NDJSON-ish lines prefixed "0:<json-encoded-chunk>"
// (see app/api/chat/route.ts) — this collapses a full response body back
// into plain text. Shared by the explanation fetch below and by any other
// caller (e.g. the regular-exercise Run verdict) that talks to /api/chat.
export function parseChatStream(text: string): string {
  const parts = text.split("\n").filter((l) => l.startsWith("0:"));
  return parts
    .map((l) => {
      try {
        return JSON.parse(l.slice(2));
      } catch {
        return "";
      }
    })
    .join("");
}

// Builds the prompt for the "Explanation" tab. `context` is a caller-chosen
// first line (e.g. "Module: C 07" or "Exam: Exam Week 04, Level 2") so the
// same prompt shape works for both regular modules and exam-prep exercises.
export function buildExplanationPrompt({
  context,
  title,
  description,
  prototype,
  allowed,
}: {
  context: string;
  title: string;
  description: string;
  prototype?: string;
  allowed?: string[];
}): string {
  const proto = prototype ? `Prototype: ${prototype}` : "";
  const allowedLine =
    allowed && allowed.length > 0 ? `Allowed: ${allowed.join(", ")}` : "";
  return `You are teaching beginners at the 42 School C Piscine. Be simple and direct. NEVER give the complete solution — students must figure it out themselves. Show SIMILAR examples instead, never the exact answer.

${context}
Exercise: ${title}
Description: ${description}
${proto}
${allowedLine}

Reply in this exact format:

WHAT YOU'RE LEARNING:
1 short sentence about the concept.

HOW TO APPROACH:
- Think about what the function receives as input
- What should it do with that input
- What should it output (if anything)

SIMILAR EXAMPLE:
\`\`\`c
// Show a DIFFERENT but similar function — NOT the solution to this exercise.
// For example: if the exercise asks to print a char, show how to print a number instead.
// This helps them understand the pattern without giving away the answer.
\`\`\`

HOW IT BEHAVES:
\`\`\`
// Show what the SIMILAR example does with real input/output
\`\`\`

WATCH OUT FOR:
- Common mistake beginners make
- Another mistake`;
}

// Auto-fetches (and localStorage-caches) an AI explanation for a single
// exercise, keyed by `cacheKey`. Used by both regular module exercises and
// exam-prep exercises — same prompt format, same cache-then-render pattern.
export function ExplanationPanel({
  cacheKey,
  prompt,
}: {
  cacheKey: string;
  prompt: string;
}) {
  const [explanation, setExplanation] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(cacheKey)) || "",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return;

    // Not cached — about to kick off the async fetch below, so this is a
    // one-time transition into a loading state, not a re-render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
        });
        const text = await res.text();
        const content = parseChatStream(text);
        setExplanation(content);
        localStorage.setItem(cacheKey, content);
      } catch {
        setExplanation("Failed to load.");
      }
      setLoading(false);
    })();
  }, [cacheKey, prompt]);

  if (loading) {
    return (
      <div className="space-y-2 mt-1">
        <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
        <div className="h-3 w-full rounded bg-muted animate-pulse" />
        <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return <ExplanationText text={explanation || "Generating..."} />;
}

export function ExplanationText({ text }: { text: string }) {
  const lines = text.split("\n");
  const els: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (
      /^(WHAT YOU'RE LEARNING|HOW TO APPROACH|SIMILAR EXAMPLE|HOW IT BEHAVES|WATCH OUT FOR):?$/i.test(
        line.trim(),
      )
    ) {
      els.push(
        <h4
          key={i}
          className="text-[11px] font-bold text-foreground mt-4 mb-2 uppercase tracking-wide"
        >
          {line.trim().replace(/:$/, "")}
        </h4>,
      );
      i++;
    } else if (line.trim().startsWith("```")) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      els.push(
        <pre
          key={i}
          className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border text-xs font-mono overflow-x-auto my-2"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
    } else if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      els.push(
        <ul key={i} className="space-y-1 ml-1">
          {items.map((it, j) => (
            <li
              key={j}
              className="text-[13px] text-muted-foreground leading-relaxed flex gap-1.5"
            >
              <span className="text-muted-foreground/40 mt-0.5">-</span>
              <InlineCode text={it} />
            </li>
          ))}
        </ul>,
      );
    } else if (line.trim()) {
      els.push(
        <p key={i} className="text-[13px] text-muted-foreground leading-relaxed">
          <InlineCode text={line.trim()} />
        </p>,
      );
      i++;
    } else {
      i++;
    }
  }
  return <div>{els}</div>;
}

function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts
        .filter(Boolean)
        .map((part, i) =>
          part.startsWith("`") && part.endsWith("`") ? (
            <code key={i} className="px-1 py-px rounded bg-muted font-mono text-[11px]">
              {part.slice(1, -1)}
            </code>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
    </>
  );
}
