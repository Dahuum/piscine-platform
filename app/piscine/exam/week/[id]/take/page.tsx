'use client'

import { Check, ChevronLeft, Clock, Monitor, PanelTopClose, PanelTopOpen, Play, RotateCw, Terminal, Trophy } from 'lucide-react'
import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import CodeEditor from '@/components/piscine/code-editor'
import NavIsland from '@/components/nav-island'
import ThemeToggle from '@/components/theme-toggle'
import ToTop from '@/components/to-top'
import { saveExamAttempt } from '@/lib/piscine/db'
import { getExamWeekOrNull, getExercise, type ExamExercise } from '@/lib/piscine/exam-data'

type Stage = 'select' | 'confirm' | 'active'

export default function ExamTakePage() {
  const params = useParams<{ id: string }>()
  const weekId = params.id
  const week = getExamWeekOrNull(weekId)
  if (!week) notFound()
  return <ExamInner weekId={weekId} />
}

function SubjectText({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim().startsWith('$>')) {
      const codeLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('$>')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(<pre key={`c${i}`}>{codeLines.join('\n')}</pre>)
    } else if (line.trim() === '') {
      i++
    } else {
      const paraLines: string[] = []
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('$>')) {
        paraLines.push(lines[i])
        i++
      }
      elements.push(<p key={`p${i}`}>{paraLines.join('\n')}</p>)
    }
  }
  return <>{elements}</>
}

function ExamInner({ weekId }: { weekId: string }) {
  const router = useRouter()
  const week = getExamWeekOrNull(weekId)!
  const [stage, setStage] = useState<Stage>('select')
  const [token, setToken] = useState<string | null>(null)
  const [exercise, setExercise] = useState<{ name: string; level: number; type: string; subject: ExamExercise['subject'] } | null>(null)
  const [promptOpen, setPromptOpen] = useState(true)
  const [code, setCode] = useState('')
  const [grading, setGrading] = useState(false)
  const [feedback, setFeedback] = useState<{ passed?: boolean; traceback?: string; compilationError?: string } | null>(null)
  const [cooldown, setCooldown] = useState<{ until: number; remaining: number } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(week.timeMinutes * 60)
  const [currentLevel, setCurrentLevel] = useState(0)
  const [currentGrade, setCurrentGrade] = useState(0)
  const [levelHistory, setLevelHistory] = useState<{ level: number; exercise: string; passed: boolean; attempts: number }[]>([])
  const [status, setStatus] = useState('active')
  const [examComplete, setExamComplete] = useState(false)
  const [showNewLevel, setShowNewLevel] = useState(false)
  const [starting, setStarting] = useState(false)
  const [resuming, setResuming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tokenKey = `exam:token:${weekId}`
  const getVisitorId = () => {
    if (typeof window === 'undefined') return Math.random().toString(36).slice(2, 10)
    let v = localStorage.getItem('visitor-id')
    if (!v) {
      v = Math.random().toString(36).slice(2, 10)
      localStorage.setItem('visitor-id', v)
    }
    return v
  }

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem(tokenKey) : null
    if (!saved) return
    setResuming(true)
    fetch(`/api/piscine/exam/status?token=${encodeURIComponent(saved)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) {
          sessionStorage.removeItem(tokenKey)
          return
        }
        if (data.status !== 'active') {
          sessionStorage.removeItem(tokenKey)
          if (data.status === 'completed' || data.status === 'timeout') router.replace(`/piscine/exam/week/${weekId}/results`)
          return
        }
        const resolved = getExercise(weekId, data.currentLevel, data.currentExercise)
        setToken(saved)
        setCurrentLevel(data.currentLevel)
        setCurrentGrade(data.grade)
        setLevelHistory(data.levelHistory || [])
        setTimeRemaining(Math.round(data.timeRemaining))
        if (data.cooldownUntil > Date.now()) setCooldown({ until: data.cooldownUntil, remaining: Math.ceil((data.cooldownUntil - Date.now()) / 1000) })
        if (resolved) setExercise({ name: resolved.name, level: resolved.level, type: resolved.type, subject: resolved.subject })
        setStatus('active')
        setStage('active')
      })
      .catch(() => sessionStorage.removeItem(tokenKey))
      .finally(() => setResuming(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startExam = async () => {
    if (starting) return
    setStarting(true)
    try {
      const res = await fetch('/api/piscine/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, mode: 'editor', visitorId: getVisitorId() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to start exam')
      }
      const data = await res.json()
      setToken(data.token)
      sessionStorage.setItem(tokenKey, data.token)
      setExercise(data.exercise)
      setCode('')
      setCurrentLevel(data.currentLevel ?? 0)
      setCurrentGrade(data.currentGrade ?? 0)
      setLevelHistory(data.levelHistory || [])
      setFeedback(null)
      setCooldown(data.cooldownUntil && data.cooldownUntil > Date.now() ? { until: data.cooldownUntil, remaining: Math.ceil((data.cooldownUntil - Date.now()) / 1000) } : null)
      setStage('active')
      setStatus('active')
      setExamComplete(false)
      setShowNewLevel(false)
      setTimeRemaining(data.resumed ? Math.round(data.timeRemaining) : data.timeLimitSeconds)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to start')
    } finally {
      setStarting(false)
    }
  }

  const timerTick = useCallback(() => {
    setTimeRemaining((prev) => {
      const next = prev - 1
      if (next <= 0) {
        setStatus('timeout')
        return 0
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (stage === 'active') {
      timerRef.current = setInterval(timerTick, 1000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [stage, timerTick])

  const saveToHistory = (data: { grade?: number; levelHistory?: typeof levelHistory }) => {
    try {
      const raw = localStorage.getItem('exam:history')
      const history = raw ? JSON.parse(raw) : []
      history.unshift({
        id: Math.random().toString(36).slice(2, 10),
        weekId,
        mode: 'editor',
        startedAt: Date.now() - (week.timeMinutes * 60 - timeRemaining) * 1000,
        endedAt: Date.now(),
        duration: week.timeMinutes * 60 - timeRemaining,
        result: status === 'timeout' ? 'timeout' : 'completed',
        finalGrade: data.grade ?? currentGrade,
        levels: data.levelHistory || levelHistory,
      })
      localStorage.setItem('exam:history', JSON.stringify(history))
      saveExamAttempt(history[0]).catch(() => {})
    } catch {}
  }

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  useEffect(() => {
    if (status === 'timeout' && token) {
      sessionStorage.removeItem(tokenKey)
      fetch('/api/piscine/exam/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: 'timeout' }),
      })
        .then((r) => r.json())
        .then((d) => saveToHistory(d))
        .catch(() => saveToHistory({}))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token])

  useEffect(() => {
    if (cooldown && cooldown.remaining > 0) {
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (!prev) return null
          const remaining = Math.max(0, Math.ceil((prev.until - Date.now()) / 1000))
          return remaining <= 0 ? null : { ...prev, remaining }
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [cooldown])

  const processGradeResponse = async (res: Response) => {
    const data = await res.json()
    if (res.status === 429) {
      setCooldown({ until: Date.now() + data.cooldownRemaining, remaining: Math.ceil(data.cooldownRemaining / 1000) })
      return
    }
    if (data.systemError) {
      setFeedback({ passed: false, traceback: data.error, compilationError: data.compilationError })
      return
    }
    if (data.exercise) {
      setExercise(data.exercise)
      setCode('')
      setFeedback({ passed: false, traceback: "That exercise changed — you've been given a new one, please try again." })
      return
    }
    if (data.error) {
      if (data.status === 'timeout') {
        setStatus('timeout')
        return
      }
      setFeedback({ passed: false, traceback: data.error })
      return
    }
    if (data.passed) {
      if (data.examComplete) {
        setExamComplete(true)
        setCurrentGrade(data.finalGrade || 100)
        setLevelHistory(data.levelHistory || [])
        setStatus('completed')
        sessionStorage.removeItem(tokenKey)
        saveToHistory({ grade: data.finalGrade, levelHistory: data.levelHistory })
        fetch('/api/piscine/exam/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, reason: 'completed' }) }).catch(() => {})
        return
      }
      setFeedback({ passed: true })
      setShowNewLevel(true)
      setCurrentGrade(data.grade)
      setLevelHistory(data.levelHistory)
      setCooldown(null)
      setTimeout(() => {
        setCurrentLevel(data.newLevel)
        if (data.newExercise) setExercise(data.newExercise)
        setCode('')
        setFeedback(null)
        setShowNewLevel(false)
      }, 1800)
    } else {
      setFeedback({ passed: false, traceback: data.traceback, compilationError: data.compilationError })
      if (data.cooldownSeconds > 0) setCooldown({ until: Date.now() + data.cooldownSeconds * 1000, remaining: data.cooldownSeconds })
    }
  }

  const handleSubmit = async () => {
    if (!code.trim() || !token || grading) return
    setGrading(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/piscine/exam/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, studentCode: code }),
      })
      await processGradeResponse(res)
    } catch {
      setFeedback({ passed: false, traceback: 'Network error' })
    }
    setGrading(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && stage === 'active') {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, code, token, grading])

  const finishExam = async () => {
    sessionStorage.removeItem(tokenKey)
    if (token) {
      try {
        await fetch('/api/piscine/exam/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, reason: 'abandoned' }) })
      } catch {}
    }
    router.push(`/piscine/exam/week/${weekId}/results`)
  }

  if (resuming) {
    return (
      <main className="app-shell">
        <NavIsland />
        <div className="nf-shell">
          <RotateCw size={22} className="spin" color="var(--soft)" />
        </div>
      </main>
    )
  }

  if (examComplete) {
    return (
      <main className="app-shell">
        <NavIsland />
        <div className="exam-complete">
          <Trophy size={48} color="var(--teal)" style={{ margin: '0 auto' }} />
          <p className="eyebrow rise">{status === 'timeout' ? 'Time ran out' : 'All levels completed'}</p>
          <h1 className="rise" style={{ '--i': 1 } as CSSProperties}>Exam complete!</h1>
          <p className="exam-complete-grade rise" style={{ '--i': 2 } as CSSProperties}>
            {currentGrade}<span>/100</span>
          </p>
          <p className="nf-sub rise" style={{ '--i': 3 } as CSSProperties}>{levelHistory.filter((h) => h.passed).length} of {week.levelCount} levels passed</p>
          <div className="prevnext rise" style={{ '--i': 4, gridTemplateColumns: '1fr 1fr', maxWidth: 360, margin: '20px auto 0' } as CSSProperties}>
            <Link href={`/piscine/exam/week/${weekId}/results`}><small>View</small><b>Results</b></Link>
            <button className="pn-next" style={{ all: 'unset', cursor: 'pointer' }} onClick={() => window.location.reload()}>
              <small style={{ color: 'var(--soft)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em' }}>Retry</small>
              <b style={{ display: 'block', fontSize: 13, letterSpacing: '-.03em' }}>Retake exam</b>
            </button>
          </div>
        </div>
        <ToTop />
      </main>
    )
  }

  if (stage === 'select') {
    return (
      <main className="app-shell" id="top">
        <NavIsland />
        <header className="dir-hero">
          <Link href="/piscine/exam" className="back-link" style={{ marginTop: 0 }}>← Exam Gate</Link>
          <h1 className="rise" style={{ '--i': 1 } as CSSProperties}>{week.title} — Real exam</h1>
          <p className="rise" style={{ '--i': 2 } as CSSProperties}>{week.description}</p>
        </header>

        <div className="rncp-grid" style={{ marginTop: 20 }}>
          <div className="rncp-card" style={{ textAlign: 'center' }}><Clock size={16} color="var(--soft)" style={{ margin: '0 auto 6px' }} /><b style={{ display: 'block', fontSize: 15 }}>240 min</b><small style={{ color: 'var(--soft)', fontSize: 10.5 }}>4 hours</small></div>
          <div className="rncp-card" style={{ textAlign: 'center' }}><b style={{ display: 'block', fontSize: 15 }}>{week.levelCount} levels</b><small style={{ color: 'var(--soft)', fontSize: 10.5 }}>0 → {week.levelCount - 1}</small></div>
          <div className="rncp-card" style={{ textAlign: 'center' }}><b style={{ display: 'block', fontSize: 15 }}>{Math.round(week.gradePerLevel)} pts</b><small style={{ color: 'var(--soft)', fontSize: 10.5 }}>per level</small></div>
        </div>

        <div className="modal-summary" style={{ marginTop: 18, maxWidth: 480 }}>
          <span>No AI assistance during the exam</span>
          <span>Random exercise drawn per level</span>
          <span>Cooldown increases on repeated failures</span>
          <span>Exam ends when all levels complete or time runs out</span>
        </div>

        <p className="ide-field-label" style={{ marginTop: 22 }}>Choose mode</p>
        <div className="choice-grid">
          <div className="choice-card on">
            <span className="choice-check"><Check size={12} strokeWidth={3} /></span>
            <Monitor size={16} />
            <b>Editor</b>
            <small>Monaco editor + Run button</small>
          </div>
          <div className="choice-card" style={{ opacity: 0.45, pointerEvents: 'none' }}>
            <Terminal size={16} />
            <b>Terminal</b>
            <small>Needs an always-on server — not set up yet</small>
          </div>
        </div>

        <button className="primary-action rise" style={{ '--i': 3, marginTop: 22 } as CSSProperties} onClick={() => setStage('confirm')}>
          Continue with Editor <span>→</span>
        </button>

        <footer><span>{week.title} · real exam</span><span>Made for the long way around.</span></footer>
        <ToTop />
      </main>
    )
  }

  if (stage === 'confirm') {
    return (
      <main className="app-shell">
        <NavIsland />
        <div className="nf-shell">
          <Clock size={40} color="var(--gold)" />
          <p className="eyebrow rise">Ready to begin?</p>
          <h1 className="rise" style={{ '--i': 1 } as CSSProperties}>{week.title}</h1>
          <p className="nf-sub rise" style={{ '--i': 2 } as CSSProperties}>
            Editor mode · Timer starts when you press Begin · 240 minutes · Cannot be paused.
          </p>
          <div className="rise" style={{ '--i': 3, display: 'flex', gap: 10, justifyContent: 'center' } as CSSProperties}>
            <button className="modal-ghost" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setStage('select')} disabled={starting}>Back</button>
            <button className="modal-submit" style={{ width: 'auto', padding: '0 20px' }} onClick={startExam} disabled={starting}>
              {starting ? 'Starting…' : 'Begin exam'}
            </button>
          </div>
        </div>
        <ToTop />
      </main>
    )
  }

  return (
    <div className="ide-page">
      <div className="ide-topbar">
        <span className={`exam-timer ${timeRemaining < 1800 ? 'warn' : ''}`}>{formatTime(timeRemaining)}</span>
        <span className="sep">·</span>
        <span className="exam-meta">Level {currentLevel}/{week.levelCount}</span>
        <span className="sep">·</span>
        <span className="exam-meta">Grade {currentGrade}/100</span>
        <span className="spacer" />
        <div className="exam-dots">
          {Array.from({ length: week.levelCount }, (_, i) => {
            const h = levelHistory.find((x) => x.level === i)
            const cls = h?.passed ? 'pass' : i === currentLevel && status !== 'timeout' ? 'current' : h ? 'fail' : ''
            return <span key={i} className={`exam-dot ${cls}`} title={`Level ${i}${h ? `: ${h.exercise} (${h.passed ? 'passed' : 'failed'})` : ''}`} />
          })}
        </div>
        {exercise && (
          <button className="ide-icon-btn" onClick={() => setPromptOpen((o) => !o)} aria-label={promptOpen ? 'Hide prompt' : 'Show prompt'}>
            {promptOpen ? <PanelTopClose size={14} /> : <PanelTopOpen size={14} />}
          </button>
        )}
        <button className="ide-icon-btn" onClick={finishExam} aria-label="Finish exam"><ChevronLeft size={15} /></button>
        <ThemeToggle />
      </div>

      {status === 'timeout' && <div className="exam-timeout-banner">Time expired. Exam ended.</div>}

      <div className="ide-body" style={{ flexDirection: 'column' }}>
        {exercise && promptOpen && (
          <div className="exam-prompt">
            <h2>{exercise.name}</h2>
            <div className="exam-prompt-body"><SubjectText text={exercise.subject.description} /></div>
            {(exercise.subject.files.length > 0 || exercise.subject.allowed.length > 0) && (
              <div className="exam-prompt-meta">
                {exercise.subject.files.length > 0 && <span>Turn-in: <code>{exercise.subject.files.join(', ')}</code></span>}
                {exercise.subject.allowed.length > 0 && <span>Allowed: <code>{exercise.subject.allowed.join(', ')}</code></span>}
              </div>
            )}
          </div>
        )}

        <div className="ide-editor" style={{ flex: 1 }}>
          <CodeEditor value={code} onChange={(v) => setCode(v || '')} language="c" />
        </div>

        <div className="exam-submit-bar">
          <button className="exam-submit" onClick={handleSubmit} disabled={grading || !code.trim() || cooldown !== null || status !== 'active'}>
            {grading ? <RotateCw size={13} className="spin" /> : <Play size={13} />}
            {grading ? 'Grading…' : 'Submit for grading'}
          </button>
          <span className="ide-hint">⌘⏎</span>
          {cooldown && <span className="exam-cooldown">Cooldown: {cooldown.remaining}s</span>}
          <span className="spacer" style={{ flex: 1 }} />
          <span className="exam-meta">L{currentLevel} · {exercise?.name}</span>
        </div>

        {showNewLevel && (
          <div className="exam-feedback pass">
            <div className="exam-feedback-title"><Check size={15} /> Passed! Advancing to level {currentLevel + 1}…</div>
          </div>
        )}
        {feedback && !showNewLevel && !feedback.passed && (
          <div className="exam-feedback fail">
            <div className="exam-feedback-title">❌ Failed — {feedback.compilationError ? 'Compilation error' : "Tests didn't match"}</div>
            <pre>{feedback.traceback || feedback.compilationError}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
