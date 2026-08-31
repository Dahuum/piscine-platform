'use client'

import { Check, ChevronRight, Code2, Terminal } from 'lucide-react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { getPrepExercises, getPrepReview, savePrepReview } from '@/lib/piscine/db'
import { getAvailableLevels, getExamWeekOrNull } from '@/lib/piscine/exam-data'

export default function ExamPrepPage() {
  const params = useParams<{ id: string }>()
  const weekId = params.id
  const week = getExamWeekOrNull(weekId)
  if (!week) notFound()
  return <PrepInner weekId={weekId} />
}

function PrepInner({ weekId }: { weekId: string }) {
  const week = getExamWeekOrNull(weekId)!
  const levels = getAvailableLevels(week)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0]))
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    ;(async () => {
      const d = new Set<string>()
      try {
        const dbDone = await getPrepExercises(weekId)
        for (const key of dbDone) d.add(key)
      } catch {}
      for (const ex of week.exercises) {
        const key = `${ex.level}:${ex.name}`
        if (localStorage.getItem(`exam:prep:${weekId}:${key}`) === 'done') d.add(key)
      }
      setDone(d)

      try {
        const dbReviewed = await getPrepReview(weekId)
        if (dbReviewed) setReviewed(true)
      } catch {}
      if (localStorage.getItem(`exam:prep:reviewed:${weekId}`) === 'true') setReviewed(true)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })()
  }, [weekId])

  const totalDone = done.size
  const totalExercises = week.exercises.length
  const overallPct = totalExercises > 0 ? Math.round((totalDone / totalExercises) * 100) : 0

  const toggleLevel = (lvl: number) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev)
      next.has(lvl) ? next.delete(lvl) : next.add(lvl)
      return next
    })
  }

  const markReviewed = () => {
    const next = !reviewed
    localStorage.setItem(`exam:prep:reviewed:${weekId}`, String(next))
    setReviewed(next)
    if (next) savePrepReview(weekId).catch(() => {})
  }

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <Link href="/piscine/exam" className="back-link" style={{ marginTop: 0 }}>← Exam Gate</Link>
        <p className="eyebrow rise" style={{ '--i': 1 } as CSSProperties}>{week.title}</p>
        <h1 className="rise" style={{ '--i': 2 } as CSSProperties}>Preparation</h1>
        <p className="rise" style={{ '--i': 3 } as CSSProperties}>Review every exercise before taking the real, timed exam.</p>
        <div className="dir-hero-stats rise" style={{ '--i': 4 } as CSSProperties}>
          <span><b>{totalDone}</b>/{totalExercises} done</span>
          <span><b>{overallPct}%</b> reviewed</span>
        </div>
      </header>

      <div style={{ margin: '20px 0' }}>
        <button className={`choice-card ${reviewed ? 'on' : ''}`} style={{ maxWidth: 320, padding: '14px 18px' }} onClick={markReviewed}>
          <span className="choice-check"><Check size={12} strokeWidth={3} /></span>
          <b>{reviewed ? 'Reviewed — exam unlocked' : 'Mark all as reviewed'}</b>
          <small>{reviewed ? 'The real exam is now available.' : 'Unlocks the timed exam for this week.'}</small>
        </button>
      </div>

      <div className="project-list">
        {levels.map((lvl, i) => {
          const exercises = week.exercisesByLevel[lvl] || []
          const lvlDone = exercises.filter((e) => done.has(`${lvl}:${e.name}`)).length
          const isOpen = expandedLevels.has(lvl)
          return (
            <article className={`project stagger-item ${isOpen ? 'expanded' : ''}`} key={lvl} style={{ '--i': i } as CSSProperties}>
              <button className="project-main" onClick={() => toggleLevel(lvl)} aria-expanded={isOpen}>
                <span className="cell-proj">
                  <span className="cell-name">Level {lvl}</span>
                  <small className="cell-sub">{exercises.length} exercises</small>
                </span>
                <span className="cell-side">
                  <span className="pxp">{lvlDone}/{exercises.length}</span>
                </span>
                <span className="caret"><ChevronRight size={16} /></span>
              </button>
              <div className={`acc ${isOpen ? 'open' : ''}`}>
                <div className="acc-inner">
                  <div className="project-detail" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {exercises.map((ex) => {
                      const isDone = done.has(`${lvl}:${ex.name}`)
                      return (
                        <Link key={ex.name} href={`/piscine/exam/week/${weekId}/prep/${lvl}/${ex.name}`} className="suite-pair" style={{ textDecoration: 'none' }}>
                          <span className={`suite-check ${isDone ? 'met' : ''}`}><Check size={11} strokeWidth={3} className="suite-check-icon" /></span>
                          <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', fontWeight: 600, fontSize: 12 }}>{ex.name}</span>
                          {ex.type === 'function' ? <Code2 size={12} color="var(--soft)" /> : <Terminal size={12} color="var(--soft)" />}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <footer>
        <span>{week.title} · preparation mode</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
