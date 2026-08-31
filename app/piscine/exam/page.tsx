'use client'

import { ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { getExamHistory, getPrepReview } from '@/lib/piscine/db'
import { examWeeks } from '@/lib/piscine/exam-data'

type Stat = { label: string; value: string }

function processHistory(history: { finalGrade: number; result: string; duration: number }[]) {
  const total = history.length
  const best = total ? Math.max(...history.map((a) => a.finalGrade)) : 0
  const hours = Math.round(history.reduce((s, a) => s + (a.duration || 0), 0) / 3600)
  const passes = history.filter((a) => a.result === 'completed').length
  const passRate = total ? Math.round((passes / total) * 100) : 0
  return [
    { label: 'Exams', value: String(total) },
    { label: 'Best', value: `${best}%` },
    { label: 'Hours', value: `${hours}h` },
    { label: 'Pass rate', value: `${passRate}%` },
  ]
}

export default function ExamGateDashboard() {
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({})
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Exams', value: '0' },
    { label: 'Best', value: '—' },
    { label: 'Hours', value: '0h' },
    { label: 'Pass rate', value: '—' },
  ])

  useEffect(() => {
    ;(async () => {
      const r: Record<string, boolean> = {}
      for (const id of Object.keys(examWeeks)) {
        r[id] = localStorage.getItem(`exam:prep:reviewed:${id}`) === 'true'
        try {
          const dbReviewed = await getPrepReview(id)
          if (dbReviewed) r[id] = true
        } catch {}
      }
      setReviewed(r)

      try {
        const dbHistory = await getExamHistory()
        if (dbHistory.length > 0) {
          setStats(processHistory(dbHistory))
          return
        }
      } catch {}

      try {
        const raw = localStorage.getItem('exam:history')
        if (raw) {
          setStats(processHistory(JSON.parse(raw)))
        }
      } catch {}
    })()
  }, [])

  const weeks = Object.values(examWeeks)

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <Link href="/piscine" className="back-link" style={{ marginTop: 0 }}>
          ← Piscine
        </Link>
        <p className="eyebrow rise" style={{ '--i': 1 } as CSSProperties}>Timed exams · real grading</p>
        <h1 className="rise" style={{ '--i': 2 } as CSSProperties}>Exam Gate</h1>
        <p className="rise" style={{ '--i': 3 } as CSSProperties}>
          {weeks.length} exam weeks, each a randomized set of levels compiled and graded against a real
          reference solution — not an AI opinion.
        </p>
        <div className="dir-hero-stats rise" style={{ '--i': 4 } as CSSProperties}>
          {stats.map((s) => (
            <span key={s.label}><b>{s.value}</b> {s.label.toLowerCase()}</span>
          ))}
        </div>
      </header>

      <div className="rncp-grid" style={{ marginTop: 24 }}>
        {weeks.map((week) => {
          const isReviewed = reviewed[week.id] || false
          return (
            <article key={week.id} className="rncp-card">
              <div className="rncp-card-head">
                <b>{week.title}</b>
                {isReviewed && <span className="rncp-met">Reviewed</span>}
              </div>
              <p style={{ margin: '0 0 10px', color: 'var(--soft)', fontSize: 11.5, lineHeight: 1.5 }}>{week.description}</p>
              <div className="rncp-card-meta">
                <span>{week.exercises.length} exercises</span>
                <span>{week.levelCount} levels · 240 min</span>
              </div>
              <div className="rncp-proj-chips">
                <Link href={`/piscine/exam/week/${week.id}/prep`} className="relchip">Preparation</Link>
                {isReviewed ? (
                  <Link href={`/piscine/exam/week/${week.id}/take`} className="relchip relchip-done">
                    Start exam <ArrowRight size={11} style={{ display: 'inline', verticalAlign: -1 }} />
                  </Link>
                ) : (
                  <span className="relchip relchip-muted">
                    <Lock size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                    Review prep first
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <p style={{ margin: '28px 0 0', textAlign: 'center' }}>
        <Link href="/piscine/exam/history" className="detail-link" style={{ justifyContent: 'center' }}>
          View exam history →
        </Link>
      </p>

      <footer>
        <span>Graded live in a sandboxed compiler against real reference solutions.</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
