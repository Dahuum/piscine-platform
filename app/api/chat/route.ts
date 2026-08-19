import { NextRequest } from "next/server";
import { examWeeks } from "@/lib/exam-data";

// Small enough (~700 chars for all 3 weeks) to always include — unlike
// per-module/per-exercise context, this shouldn't depend on which page the
// question was asked from. A student on the home page asking "how many
// points is a level worth" should get a real answer, not a guess just
// because they weren't standing on an exam page when they asked.
function buildPlatformFacts(): string {
  return Object.values(examWeeks)
    .map(
      (week) =>
        `${week.title} (id: ${week.id}): ${week.levelCount} levels (0 through ${week.levelCount - 1}), ${week.gradePerLevel} points per level (${week.gradePerLevel * week.levelCount} points total), ${week.timeMinutes} minute time limit. A wrong submission triggers an increasing cooldown before the next attempt. One random exercise is drawn per level.`,
    )
    .join("\n");
}

// The response streams, and its total duration isn't bounded by max_tokens
// alone (slow upstream generation, long conversations) — give it the same
// headroom as the other routes rather than relying on Vercel's 10s default.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { messages, pageContext } = await req.json();

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return new Response("API key not configured.", { status: 500 });
  }

  const isOpenRouter = apiKey.startsWith("sk-or-");
  const url = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.deepseek.com/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (isOpenRouter) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    headers["X-Title"] = "42 Piscine Platform";
  }

  const body = {
    // deepseek/deepseek-chat is a paid model and requires a funded OpenRouter
    // balance — the account backing this had none (confirmed via a live 402
    // "requires more credits" response). openai/gpt-oss-20b:free is a real,
    // genuinely zero-cost model on OpenRouter (no balance/payment method
    // needed at all, just rate-limited), so this keeps every AI feature
    // (exercise verdicts, explanations, exam chat) working without
    // requiring anyone to pay anything. Override via OPENROUTER_MODEL if a
    // funded account/paid model is ever preferred instead.
    model: isOpenRouter
      ? process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free"
      : "deepseek-chat",
    messages: [
      {
        role: "system",
        content:
          "You are a teaching assistant for the 42 School C Piscine. Guide students without giving direct answers. Encourage them to think, explain concepts clearly, and help them debug their code. Be concise. The student is learning C programming and shell scripting. Never give complete solutions. Use proper markdown formatting for code blocks and clear explanations." +
          `\n\nThis platform (not the real 42 curriculum) runs its own exam weeks with these exact mechanics — use ONLY these facts for exam structure/rules/levels/points questions, regardless of what page the student is asking from, and do not fall back to general knowledge about real 42 exams for anything covered here:\n${buildPlatformFacts()}` +
          (typeof pageContext === "string" && pageContext
            ? `\n\nThe student is currently on the page described below. This platform's days and exercises have their own titles and numbers that do not necessarily match the real 42 curriculum or general knowledge — answer from these facts, not assumptions:\n${pageContext}`
            : ""),
      },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ],
    max_tokens: 1024,
    temperature: 0.7,
    stream: true,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Chat API error:", err);
    return new Response(err, { status: response.status });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
              }
            } catch {
              // skip invalid JSON
            }
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1",
    },
  });
}
