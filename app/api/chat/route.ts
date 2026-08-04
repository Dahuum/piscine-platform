import { NextRequest } from "next/server";

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
    model: isOpenRouter
      ? process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat"
      : "deepseek-chat",
    messages: [
      {
        role: "system",
        content:
          "You are a teaching assistant for the 42 School C Piscine. Guide students without giving direct answers. Encourage them to think, explain concepts clearly, and help them debug their code. Be concise. The student is learning C programming and shell scripting. Never give complete solutions. Use proper markdown formatting for code blocks and clear explanations." +
          (typeof pageContext === "string" && pageContext
            ? `\n\nThe student is currently on the page described below, on this specific platform (not the real 42 curriculum — this platform's own days, exercises, and exam weeks, which have their own titles, exercise sets, and numbers that do not necessarily match real 42 or general knowledge). If asked about the current day/module, exercise, or exam's structure, rules, levels, or points, answer ONLY from these facts — do not fall back to general knowledge about 42 for anything covered here:\n${pageContext}`
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
