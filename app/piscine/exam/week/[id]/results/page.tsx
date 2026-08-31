'use client'

import { Clock, Trophy, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { getExamHistory } from '@/lib/piscine/db'
import { getExamWeekOrNull } from '@/lib/piscine/exam-data'

type LevelEntry = { level: number; exercise: string; passed: boolean; attempts: number; timeSpentSeconds?: number }
type AttemptData = { weekId: string; mode: string; startedAt: number; endedAt: number; duration: number; result: string; finalGrade: number; levels: LevelEntry[] }

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h > 0 ? h + 'h ' : ''}${m}min ${s}s`
}

export default function ExamResultsPage() {
  const params = useParams<{ id: string }>()
  const weekId = params.id
  const week = getExamWeekOrNull(weekId)
  const [attempt, setAttempt] = useState<AttemptData | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const dbHistory = await getExamHistory()
        const latest = dbHistory.find((a) => a.weekId === weekId)
        if (latest) {
          setAttempt(latest as AttemptData)
          return
        }
      } catch {}
      try {
        const raw = localStorage.getItem('exam:history')
        if (raw) {
          const history: AttemptData[] = JSON.parse(raw)
          const latest = history.find((a) => a.weekId === weekId)
          if (latest) setAttempt(latest)
        }
      } catch {}
    })()
  }, [weekId])

  if (!attempt) {
    return (
      <main className="app-shell">
        <NavIsland />
        <div className="nf-shell">
          <Trophy size={40} color="var(--soft)" />
          <p className="eyebrow rise">No results yet</p>
          <p className="nf-sub rise" style={{ '--i': 1 } as CSSProperties}>Complete an exam for {week?.title || weekId} to see results here.</p>
          <Link href={`/piscine/exam/week/${weekId}/take`} className="primary-action rise" style={{ '--i': 2, justifyContent: 'center' } as CSSProperties}>
            Take exam →
          </Link>
        </div>
        <ToTop />
      </main>
    )
  }

  const passedCount = attempt.levels.filter((l) => l.passed).length
  const totalAttempts = attempt.levels.reduce((s, l) => s + l.attempts, 0)
  const successRate = attempt.levels.length ? Math.round((passedCount / attempt.levels.length) * 100) : 0

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <Link href="/piscine/exam" className="back-link" style={{ marginTop: 0 }}>← Exam Gate</Link>
        <p className="eyebrow rise" style={{ '--i': 1 } as CSSProperties}>
          {attempt.result === 'completed' ? <Trophy size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} /> : attempt.result === 'timeout' ? <Clock size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} /> : <XCircle size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />}
          {week?.title || attempt.weekId} · {attempt.mode} mode
        </p>
        <h1 className="rise" style={{ '--i': 2 } as CSSProperties}>
          {attempt.result === 'completed' ? 'Exam completed' : attempt.result === 'timeout' ? 'Time expired' : 'Exam ended'}
        </h1>
        <p className="rise" style={{ '--i': 3, fontSize: 56, fontWeight: 800, letterSpacing: '-.04em', color: 'var(--ink)', margin: '10px 0' } as CSSProperties}>
          {attempt.finalGrade}<span style={{ color: 'var(--soft)', fontSize: 22 }}>/100</span>
        </p>
        <div className="dir-hero-stats rise" style={{ '--i': 4 } as CSSProperties}>
          <span><b>{passedCount}</b>/{attempt.levels.length} levels</span>
          <span><b>{formatTime(attempt.duration)}</b></span>
        </div>
      </header>

      <div className="rncp-grid" style={{ marginTop: 24 }}>
        {[
          { label: 'Passed', value: String(passedCount) },
          { label: 'Attempts', value: String(totalAttempts) },
          { label: 'Success rate', value: `${successRate}%` },
        ].map((s) => (
          <div key={s.label} className="rncp-card" style={{ textAlign: 'center' }}>
            <b style={{ display: 'block', fontSize: 22, letterSpacing: '-.03em' }}>{s.value}</b>
            <small style={{ color: 'var(--soft)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{s.label}</small>
          </div>
        ))}
      </div>

      <section className="content-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Per level</p><h2>Level breakdown</h2></div>
        </div>
        <div className="rncp-suite-grid">
          {attempt.levels.map((lvl) => (
            <div key={lvl.level} className={`suite-pair ${lvl.passed ? 'met' : ''}`}>
              <span className="suite-check"><span style={{ opacity: lvl.passed ? 1 : 1, color: lvl.passed ? 'var(--teal)' : 'var(--coral)' }}>{lvl.passed ? '✓' : '✕'}</span></span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 12 }}>L{lvl.level} · {lvl.exercise}</span>
              <span style={{ color: 'var(--soft)', fontSize: 10.5 }}>{lvl.attempts} try{lvl.attempts > 1 ? '' : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="prevnext" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Link href={`/piscine/exam/week/${weekId}/take`}><small>Retake</small><b>Start a new attempt</b></Link>
        <Link href="/piscine/exam" className="pn-next"><small>Back</small><b>Exam Gate</b></Link>
      </div>

      <footer>
        <span>{week?.title || attempt.weekId} · results</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
