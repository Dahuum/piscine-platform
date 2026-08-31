'use client'

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Keyboard,
  Lightbulb,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCw,
} from 'lucide-react'
import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import CodeEditor from '@/components/piscine/code-editor'
import { ExplanationPanel } from '@/components/piscine/explanation-panel'
import ThemeToggle from '@/components/theme-toggle'
import { saveModuleProgress } from '@/lib/piscine/db'
import { buildExplanationPrompt, parseChatStream, parseVerdict, verdictPrompt } from '@/lib/piscine/explanation'
import { modules, type Module } from '@/lib/piscine/modules'

export default function ExercisePage() {
  const params = useParams<{ module: string; exercise: string }>()
  const mod = modules[params.module as keyof typeof modules]
  if (!mod) notFound()
  const exIdx = mod.exercises.findIndex((e) => e.id === params.exercise)
  if (exIdx === -1) notFound()
  // Remount on exercise change (Next/Prev navigation doesn't reload the
  // page) so all local state — code, run output, AI verdict, explanation —
  // starts fresh instead of carrying over from the previous exercise.
  return <ExercisePageInner key={`${mod.id}:${exIdx}`} mod={mod} exerciseIndex={exIdx} />
}

function ExercisePageInner({ mod, exerciseIndex }: { mod: Module; exerciseIndex: number }) {
  const ex = mod.exercises[exerciseIndex]
  const router = useRouter()
  const progressKey = `progress:${mod.id}:${ex.id}`
  const codeKey = `code:${mod.id}:${ex.id}`
  const cacheKey = `explanation:v1:${mod.id}:${ex.id}`

  // Monaco is loaded with ssr:false, so `code`'s initial value never reaches
  // server-rendered HTML — safe to read localStorage directly here. `isDone`,
  // `consoleHeight` and `leftPanelWidth` are different: they render straight
  // into visible markup/inline styles, so they start at the same SSR-safe
  // default on both server and client and get corrected by the mount effect
  // below, instead of branching on `typeof window` in the initializer (which
  // would make the client's first render disagree with the server's).
  const [code, setCode] = useState(() => (typeof window !== 'undefined' && localStorage.getItem(codeKey)) || '')
  const [output, setOutput] = useState('')
  const [verdict, setVerdict] = useState('')
  const [verdictDetails, setVerdictDetails] = useState('')
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [running, setRunning] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(true)
  const [consoleHeight, setConsoleHeight] = useState(220)
  const [leftTab, setLeftTab] = useState<'exercise' | 'explanation'>('exercise')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [leftPanelWidth, setLeftPanelWidth] = useState(340)

  useEffect(() => {
    setIsDone(localStorage.getItem(progressKey) === 'done')
    const sh = localStorage.getItem('piscine:console-height')
    if (sh) setConsoleHeight(parseInt(sh, 10))
    const w = localStorage.getItem('piscine:left-panel-width')
    if (w) setLeftPanelWidth(parseInt(w, 10))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)
  const resizingRef = useRef(false)
  const resizingLeftRef = useRef(false)
  const codeRef = useRef(code)

  useEffect(() => {
    codeRef.current = code
  }, [code])

  useEffect(() => {
    if (output && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  useEffect(() => {
    if (window.innerWidth < 1024) setConsoleOpen(false)
  }, [])

  const explanationPrompt = buildExplanationPrompt({
    context: `Module: ${mod.title}`,
    title: ex.title,
    description: ex.description,
    prototype: 'prototype' in ex ? (ex as { prototype?: string }).prototype : undefined,
    allowed: 'allowed' in ex ? (ex as { allowed?: string[] }).allowed : undefined,
  })

  const handleRun = useCallback(async () => {
    const c = codeRef.current
    if (!c.trim()) {
      setOutput('')
      setConsoleOpen(true)
      return
    }
    setRunning(true)
    setConsoleOpen(true)
    setVerdict('')
    setVerdictDetails('')
    setAiUnavailable(false)
    setOutput('')

    try {
      const res = await fetch('/api/piscine/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c, exerciseId: ex.id, moduleId: mod.id }),
      })
      const data = await res.json()
      setOutput(data.output || data.error || '(no output)')
    } catch {
      setOutput('Execution failed')
    }

    try {
      const prototype = 'prototype' in ex ? (ex as { prototype?: string }).prototype : undefined
      const aiRes = await fetch('/api/piscine/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: verdictPrompt(mod.title, ex.title, ex.description, mod.type, c, prototype) }] }),
      })
      if (!aiRes.ok) {
        setAiUnavailable(true)
      } else {
        const t = await aiRes.text()
        const { verdict: v, details: d } = parseVerdict(parseChatStream(t))
        setVerdict(v)
        setVerdictDetails(d)
      }
    } catch {
      setAiUnavailable(true)
    }

    setRunning(false)
  }, [ex, mod])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleRun()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight' && exerciseIndex < mod.exercises.length - 1) {
        e.preventDefault()
        router.push(`/piscine/${mod.id}/${mod.exercises[exerciseIndex + 1].id}`)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft' && exerciseIndex > 0) {
        e.preventDefault()
        router.push(`/piscine/${mod.id}/${mod.exercises[exerciseIndex - 1].id}`)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setConsoleOpen((o) => !o)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setLeftPanelOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRun, exerciseIndex, mod, router])

  const prevEx = exerciseIndex > 0 ? mod.exercises[exerciseIndex - 1] : null
  const nextEx = exerciseIndex < mod.exercises.length - 1 ? mod.exercises[exerciseIndex + 1] : null

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
    const startY = e.clientY
    const startH = consoleHeight
    const mm = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const h = Math.max(100, Math.min(500, startH + (startY - ev.clientY)))
      setConsoleHeight(h)
      localStorage.setItem('piscine:console-height', String(h))
    }
    const mu = () => {
      resizingRef.current = false
      document.removeEventListener('mousemove', mm)
      document.removeEventListener('mouseup', mu)
    }
    document.addEventListener('mousemove', mm)
    document.addEventListener('mouseup', mu)
  }

  const onLeftResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    resizingLeftRef.current = true
    const startX = e.clientX
    const startW = leftPanelWidth
    const mm = (ev: MouseEvent) => {
      if (!resizingLeftRef.current) return
      const w = Math.max(240, Math.min(640, startW + (ev.clientX - startX)))
      setLeftPanelWidth(w)
      localStorage.setItem('piscine:left-panel-width', String(w))
    }
    const mu = () => {
      resizingLeftRef.current = false
      document.removeEventListener('mousemove', mm)
      document.removeEventListener('mouseup', mu)
    }
    document.addEventListener('mousemove', mm)
    document.addEventListener('mouseup', mu)
  }

  const markDone = () => {
    const next = !isDone
    setIsDone(next)
    localStorage.setItem(progressKey, next ? 'done' : '')
    saveModuleProgress(mod.id, ex.id, next ? 'done' : '', codeRef.current).catch(() => {})
  }

  const verdictClass = verdict.trim().startsWith('✅') ? 'pass' : verdict.trim().startsWith('❌') ? 'fail' : ''
  const prototype = 'prototype' in ex ? (ex as { prototype?: string }).prototype : undefined
  const allowed = 'allowed' in ex ? (ex as { allowed?: string[] }).allowed : undefined

  return (
    <div className="ide-page">
      <div className="ide-topbar">
        <Link href={`/piscine/${mod.id}`} className="back-link" style={{ marginTop: 0 }}>
          <ChevronLeft size={13} /> {mod.title}
        </Link>
        <span className="sep">/</span>
        <span className="ex-title">{ex.title}</span>
        <span className="ex-num">Ex {String(ex.number).padStart(2, '0')}</span>
        {isDone && <span className="pill st-done">Done</span>}
        <span className="spacer" />
        <span className="ex-count">{exerciseIndex + 1}/{mod.exercises.length}</span>
        <button className="ide-nav-btn" disabled={!prevEx} onClick={() => prevEx && router.push(`/piscine/${mod.id}/${prevEx.id}`)} aria-label="Previous exercise">
          <ChevronLeft size={15} />
        </button>
        <button className="ide-nav-btn" disabled={!nextEx} onClick={() => nextEx && router.push(`/piscine/${mod.id}/${nextEx.id}`)} aria-label="Next exercise">
          <ChevronRight size={15} />
        </button>
        <ThemeToggle />
      </div>

      <div className="ide-body">
        {leftPanelOpen ? (
          <>
            <div className="ide-side" style={{ '--w': `${leftPanelWidth}px` } as CSSProperties}>
              <div className="ide-side-tabs">
                <button className={`ide-tab ${leftTab === 'exercise' ? 'on' : ''}`} onClick={() => setLeftTab('exercise')}>
                  <BookOpen size={13} /> Exercise
                </button>
                <button className={`ide-tab ${leftTab === 'explanation' ? 'on' : ''}`} onClick={() => setLeftTab('explanation')}>
                  <Lightbulb size={13} /> Explanation
                </button>
                <button className="ide-tab-close" onClick={() => setLeftPanelOpen(false)} aria-label="Hide panel" title="Hide panel (Ctrl+B)">
                  <PanelLeftClose size={13} />
                </button>
              </div>
              <div className="ide-side-body">
                {leftTab === 'exercise' ? (
                  <>
                    <p>{ex.description}</p>
                    {prototype && (
                      <>
                        <p className="ide-field-label">Prototype</p>
                        <div className="ide-proto">{prototype}</div>
                      </>
                    )}
                    {allowed && allowed.length > 0 && (
                      <>
                        <p className="ide-field-label">Allowed functions</p>
                        <div className="ide-fn-chips">
                          {allowed.map((fn) => (
                            <span key={fn} className="ide-fn-chip">{fn}</span>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="ide-field-label">Turn-in files</p>
                    <div className="ide-fn-chips">
                      {ex.files.map((f) => (
                        <span key={f} className="ide-fn-chip file">{f}</span>
                      ))}
                    </div>
                    <p className="ide-compile-note">
                      Compiled with {mod.type === 'shell' ? '/bin/sh' : 'gcc'}.
                      {mod.type === 'c' && ' Submit only the required function.'}
                    </p>
                  </>
                ) : (
                  <ExplanationPanel cacheKey={cacheKey} prompt={explanationPrompt} />
                )}
              </div>
            </div>
            <div className="ide-resizer-v" onMouseDown={onLeftResizeMouseDown}>
              <i />
            </div>
          </>
        ) : (
          <div className="ide-collapsed-rail">
            <button onClick={() => setLeftPanelOpen(true)} aria-label="Show panel" title="Show panel (Ctrl+B)">
              <PanelLeftOpen size={13} />
            </button>
          </div>
        )}

        <div className="ide-main">
          <div className="ide-toolbar">
            <button className="ide-run" onClick={handleRun} disabled={running}>
              {running ? <RotateCw size={13} className="spin" /> : <Play size={13} />}
              {running ? 'Running' : 'Run'}
            </button>
            <span className="ide-hint">⌘⏎</span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className={`ide-mark-done ${isDone ? 'done' : ''}`} onClick={markDone}>
              {isDone ? <Check size={12} /> : <Circle size={12} />}
              {isDone ? 'Done' : 'Mark done'}
            </button>
            <button className="ide-icon-btn" onClick={() => setShowShortcuts((s) => !s)} aria-label="Shortcuts">
              <Keyboard size={14} />
            </button>
            <button className="ide-icon-btn" onClick={() => setConsoleOpen((c) => !c)} aria-label={consoleOpen ? 'Hide console' : 'Show console'}>
              {consoleOpen ? <PanelBottomClose size={15} /> : <PanelBottomOpen size={15} />}
            </button>
          </div>

          {showShortcuts && (
            <div className="ide-shortcuts" onClick={() => setShowShortcuts(false)}>
              <b>Keyboard shortcuts</b>
              <div className="row"><span>Run code</span><kbd>⌘ ⏎</kbd></div>
              <div className="row"><span>Next exercise</span><kbd>⌘ →</kbd></div>
              <div className="row"><span>Previous exercise</span><kbd>⌘ ←</kbd></div>
              <div className="row"><span>Toggle console</span><kbd>⌘ J</kbd></div>
              <div className="row"><span>Toggle panel</span><kbd>⌘ B</kbd></div>
            </div>
          )}

          <div className="ide-editor">
            <CodeEditor
              value={code}
              onChange={(v) => {
                const val = v || ''
                setCode(val)
                localStorage.setItem(codeKey, val)
              }}
              language={mod.type === 'shell' ? 'shell' : 'c'}
            />
          </div>

          {consoleOpen && (
            <div className="ide-resizer-h" onMouseDown={onResizeMouseDown}>
              <i />
            </div>
          )}

          {consoleOpen && (
            <div className="ide-console" style={{ height: `min(${consoleHeight}px, 45vh)` }}>
              <div className="ide-console-head">
                <span className="label">Output</span>
                {running && <span className="running">running…</span>}
                <span className="spacer" style={{ flex: 1 }} />
                {aiUnavailable && <span className="ide-verdict warn">AI check unavailable</span>}
                {!aiUnavailable && verdict && <span className={`ide-verdict ${verdictClass}`}>{verdict}</span>}
              </div>
              <pre ref={outputRef} className="ide-console-body">
                {aiUnavailable && <div className="ide-console-note warn">AI correctness check is temporarily unavailable — your code still ran above.</div>}
                {!aiUnavailable && verdict && <div className={`ide-console-note ${verdictClass}`}>{verdict}</div>}
                {verdictDetails && (
                  <div className="ide-console-details">
                    <b>Failed test details</b>
                    {verdictDetails}
                  </div>
                )}
                {output || <span className="ide-console-empty">// Write code and press Run or ⌘⏎</span>}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
