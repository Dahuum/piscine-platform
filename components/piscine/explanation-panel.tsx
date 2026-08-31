'use client'

import { useEffect, useState } from 'react'
import { parseChatStream } from '@/lib/piscine/explanation'

export function ExplanationText({ text }: { text: string }) {
  const lines = text.split('\n')
  const els: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^(WHAT YOU'RE LEARNING|HOW TO APPROACH|SIMILAR EXAMPLE|HOW IT BEHAVES|WATCH OUT FOR):?$/i.test(line.trim())) {
      els.push(
        <h4 key={i} className="expl-heading">
          {line.trim().replace(/:$/, '')}
        </h4>,
      )
      i++
    } else if (line.trim().startsWith('```')) {
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      els.push(
        <pre key={i} className="expl-code">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
    } else if (line.trim().startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      els.push(
        <ul key={i} className="expl-list">
          {items.map((it, j) => (
            <li key={j}>
              <InlineCode text={it} />
            </li>
          ))}
        </ul>,
      )
    } else if (line.trim()) {
      els.push(
        <p key={i} className="expl-p">
          <InlineCode text={line.trim()} />
        </p>,
      )
      i++
    } else {
      i++
    }
  }
  return <div>{els}</div>
}

function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts
        .filter(Boolean)
        .map((part, i) =>
          part.startsWith('`') && part.endsWith('`') ? (
            <code key={i} className="expl-inline-code">{part.slice(1, -1)}</code>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
    </>
  )
}

// Auto-fetches (and localStorage-caches) an AI explanation for a single
// exercise, keyed by `cacheKey`. Used by both regular module exercises and
// exam-prep exercises — same prompt format, same cache-then-render pattern.
export function ExplanationPanel({ cacheKey, prompt }: { cacheKey: string; prompt: string }) {
  const [explanation, setExplanation] = useState(() => (typeof window !== 'undefined' && localStorage.getItem(cacheKey)) || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey)
    if (cached) return

    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/piscine/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
        })
        const text = await res.text()
        const content = parseChatStream(text)
        setExplanation(content)
        localStorage.setItem(cacheKey, content)
      } catch {
        setExplanation('Failed to load.')
      }
      setLoading(false)
    })()
  }, [cacheKey, prompt])

  if (loading) {
    return (
      <div className="expl-skeleton">
        <i style={{ width: '33%' }} />
        <i style={{ width: '100%' }} />
        <i style={{ width: '85%' }} />
        <i style={{ width: '65%' }} />
      </div>
    )
  }

  return <ExplanationText text={explanation || 'Generating…'} />
}
