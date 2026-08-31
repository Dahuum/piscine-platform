'use client'

import { Bot, Maximize2, MessageSquare, Minimize2, Send, Trash2, User, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { modules, type Exercise, type Module } from '@/lib/piscine/modules'

type Message = { id: string; role: 'user' | 'assistant'; content: string }

function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code.trimEnd()}</code></pre>`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
  html = html.replace(/\n\n/g, '</p><p>')
  html = '<p>' + html + '</p>'
  html = html.replace(/<p><\/p>/g, '')

  return html
}

let msgCounter = 0
function newId() {
  return `msg-${++msgCounter}-${Date.now()}`
}

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content: "Hello! I'm your 42 Piscine teaching assistant. I can help you understand C concepts, debug your code, and guide you through exercises. What are you working on?",
}

function describeModule(mod: Module): string {
  const exList = mod.exercises.map((e) => `${e.id} "${e.title}"`).join(', ')
  return `${mod.title} (id: ${mod.id}, "day" ${mod.order}, type: ${mod.type}): ${mod.summary} It has ${mod.exercises.length} exercises: ${exList}.`
}

function describeExercise(mod: Module, ex: Exercise): string {
  const proto = 'prototype' in ex && ex.prototype ? ` Prototype: ${ex.prototype}.` : ''
  const allowed = 'allowed' in ex && ex.allowed?.length ? ` Allowed functions: ${ex.allowed.join(', ')}.` : ''
  return `The student is currently on exercise "${ex.title}" (${ex.id}) in ${mod.title}: ${ex.description}${proto}${allowed}`
}

// Builds page-specific facts for module/exercise pages under /piscine/[module]
// — too large to always include in every request (14 modules' worth of
// exercise lists). Exam-week facts aren't built here: they're small enough
// that the API route always includes them regardless of which page a
// question is asked from.
function buildPageContext(pathname: string | null): string | null {
  if (!pathname) return null
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'piscine') return null
  const mod = segments.length >= 2 ? modules[segments[1] as keyof typeof modules] : undefined
  if (mod) {
    if (segments.length >= 3) {
      const ex = mod.exercises.find((e) => e.id === segments[2])
      if (ex) return `${describeExercise(mod, ex)}\n${describeModule(mod)}`
    }
    return describeModule(mod)
  }
  return null
}

export default function AIChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // No AI assistance during the actual timed exam — the exam's own rules say
  // so, but nothing previously enforced it since this widget renders globally.
  const isLiveExam = /^\/piscine\/exam\/week\/[^/]+\/take/.test(pathname || '')
  const pageContext = buildPageContext(pathname)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: newId(), role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    setError(null)

    const assistantId = newId()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/piscine/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated.map((m) => ({ role: m.role, content: m.content })), pageContext }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `HTTP ${res.status}`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const content = JSON.parse(line.slice(2))
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + content } : m)))
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'Failed to connect'
      setError(msg)
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content || `Error: ${msg}` } : m)))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const stopGenerating = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  if (isLiveExam) return null

  if (!open) {
    return (
      <button className="chat-trigger" onClick={() => setOpen(true)} aria-label="Open AI assistant">
        <MessageSquare size={19} />
      </button>
    )
  }

  return (
    <div className={`chat-panel ${expanded ? 'expanded' : ''}`}>
      <div className="chat-head">
        <Bot size={14} color="var(--violet)" />
        <b>AI Assistant</b>
        <span className="spacer" />
        <button className="chat-icon-btn" onClick={() => setMessages([INITIAL_MESSAGE])} aria-label="Clear chat"><Trash2 size={13} /></button>
        <button className="chat-icon-btn" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Minimize' : 'Maximize'}>
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button className="chat-icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={14} /></button>
      </div>

      <div ref={scrollRef} className="chat-body">
        {messages.map((m) => (
          <div key={m.id} className={`chat-row ${m.role}`}>
            {m.role === 'assistant' && <Bot size={14} color="var(--violet)" style={{ flex: 'none', marginTop: 3 }} />}
            {m.role === 'user' ? (
              <div className="chat-bubble">{m.content}</div>
            ) : (
              <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
            )}
            {m.role === 'user' && <User size={14} color="var(--soft)" style={{ flex: 'none', marginTop: 3 }} />}
          </div>
        ))}
        {loading && (
          <div className="chat-row assistant">
            <Bot size={14} color="var(--violet)" style={{ flex: 'none', marginTop: 3 }} />
            <div className="chat-typing">
              <i /><i /><i />
              <button className="chat-stop" onClick={stopGenerating}>Stop</button>
            </div>
          </div>
        )}
        {error && <div className="chat-error">{error}</div>}
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Ask about C, shell, or your code…"
          rows={1}
        />
        <button className="chat-send" type="submit" disabled={!input.trim() || loading} aria-label="Send">
          <Send size={13} />
        </button>
      </form>
    </div>
  )
}
