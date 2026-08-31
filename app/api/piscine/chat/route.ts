import { NextRequest } from 'next/server'
import { examWeeks } from '@/lib/piscine/exam-data'

// Small enough (~700 chars for all 4 weeks) to always include — unlike
// per-module/per-exercise context, this shouldn't depend on which page the
// question was asked from. A student on the home page asking "how many
// points is a level worth" should get a real answer, not a guess just
// because they weren't standing on an exam page when they asked.
function buildPlatformFacts(): string {
  return Object.values(examWeeks)
    .map((week) => `${week.title} (id: ${week.id}): ${week.levelCount} levels (0 through ${week.levelCount - 1}), ${week.gradePerLevel} points per level (${week.gradePerLevel * week.levelCount} points total).`)
    .join('\n')
}

// The response streams, and its total duration isn't bounded by max_tokens
// alone (slow upstream generation, long conversations) — give it the same
// headroom as the other routes rather than relying on Vercel's 10s default.
export const maxDuration = 60

// Three interchangeable providers, all OpenAI-compatible chat-completions
// APIs — pick whichever key is actually configured, preferring NVIDIA (the
// one currently funded) over OpenRouter's free tier over a direct DeepSeek
// key, and fail loudly rather than send a key to the wrong provider's URL.
function resolveProvider(): { url: string; apiKey: string; model: string; extraHeaders?: Record<string, string> } | null {
  const nvidiaKey = process.env.NVIDIA_API_KEY
  if (nvidiaKey) {
    return {
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      apiKey: nvidiaKey,
      model: process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct',
    }
  }
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (openrouterKey) {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free',
      extraHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': '42 Curriculum Map — Piscine',
      },
    }
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    return { url: 'https://api.deepseek.com/chat/completions', apiKey: deepseekKey, model: 'deepseek-chat' }
  }
  return null
}

export async function POST(req: NextRequest) {
  const { messages, pageContext } = await req.json()

  const provider = resolveProvider()
  if (!provider) {
    return new Response('API key not configured.', { status: 500 })
  }
  const { url, apiKey, model, extraHeaders } = provider

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...extraHeaders,
  }

  const body = {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a teaching assistant for the 42 School C Piscine. Guide students without giving direct answers. Encourage them to think, explain concepts clearly, and help them debug their code. Be concise, supportive, and pedagogical. Never provide full solutions unless explicitly asked for final correction hints.' +
          `\n\nThis platform (not the real 42 curriculum) runs its own exam weeks with these exact mechanics — use ONLY these facts for exam structure/rules/levels/points questions, regardless of what you know about the real 42 system:\n${buildPlatformFacts()}` +
          (typeof pageContext === 'string' && pageContext
            ? `\n\nThe student is currently on the page described below. This platform's days and exercises have their own titles and numbers that do not necessarily match the real 42 curriculum or generic online references. When the student asks about an exercise, infer from this page context first and answer according to this platform's naming/content.\n\nPage context:\n${pageContext}`
            : ''),
      },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ],
    max_tokens: 1024,
    temperature: 0.7,
    stream: true,
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })

  if (!response.ok) {
    const err = await response.text()
    console.error('Chat API error:', err)
    return new Response(err, { status: response.status })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`))
              }
            } catch {
              // skip invalid JSON
            }
          }
        }
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
    },
  })
}
