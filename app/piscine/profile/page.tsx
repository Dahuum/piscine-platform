'use client'

import { Activity, BarChart3, BookOpen, Clock, GraduationCap, Target, Trophy, User } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { examWeeks as examWeeksData } from '@/lib/piscine/exam-data'
import { getUserEmail, getUserStats, type UserStats } from '@/lib/piscine/user-stats'

const RESULT_CLASS: Record<string, string> = { completed: 'st-done', timeout: 'st-notrec', abandoned: 'st-locked' }

export default function ProfilePage() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const e = await getUserEmail()
      if (!e) {
        setLoading(false)
        return
      }
      setEmail(e)
      setStats(await getUserStats())
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <main className="app-shell">
        <NavIsland />
        <div className="nf-shell" style={{ minHeight: '50vh' }}>
          <p className="nf-sub">Loading your profile…</p>
        </div>
      </main>
    )
  }

  if (!email) {
    return (
      <main className="app-shell">
        <NavIsland />
        <div className="nf-shell">
          <User size={40} color="var(--soft)" />
          <p className="eyebrow rise">Your profile</p>
          <p className="nf-sub rise" style={{ '--i': 1 } as CSSProperties}>
            Sign in from the nav to track your progress, save exam results, and sync across devices.
          </p>
        </div>
        <ToTop />
      </main>
    )
  }

  const s = stats
  const noData = !s || (s.totalExercises === 0 && s.totalExams === 0)

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <p className="eyebrow rise">Signed in</p>
        <h1 className="rise" style={{ '--i': 1 } as CSSProperties}>{email.split('@')[0]}</h1>
        <p className="rise" style={{ '--i': 2 } as CSSProperties}>{email}</p>
      </header>

      {noData ? (
        <div className="nf-shell" style={{ minHeight: '40vh' }}>
          <Activity size={36} color="var(--soft)" />
          <p className="nf-sub rise">No data yet — start practicing or take an exam.</p>
          <div className="rise" style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 6 } as CSSProperties}>
            <Link href="/piscine" className="modal-submit" style={{ width: 'auto', padding: '0 18px', display: 'inline-flex', alignItems: 'center' }}>Start learning</Link>
            <Link href="/piscine/exam" className="modal-ghost" style={{ width: 'auto', padding: '0 18px', display: 'inline-flex', alignItems: 'center', border: '1px solid var(--rule)' }}>Exam Gate</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="rncp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginTop: 24 }}>
            {[
              { icon: Target, label: 'Exercises', value: String(s!.totalExercises) },
              { icon: BookOpen, label: 'Modules', value: `${s!.modulesCompleted}/14` },
              { icon: GraduationCap, label: 'Exams', value: String(s!.totalExams) },
              { icon: Trophy, label: 'Best grade', value: `${s!.bestExamGrade}%` },
              { icon: Clock, label: 'Hours', value: `${s!.totalHours}h` },
              { icon: BarChart3, label: 'Pass rate', value: `${s!.passRate}%` },
            ].map((st) => (
              <div key={st.label} className="rncp-card" style={{ textAlign: 'center' }}>
                <st.icon size={15} color="var(--soft)" style={{ margin: '0 auto 6px' }} />
                <b style={{ display: 'block', fontSize: 18, letterSpacing: '-.03em' }}>{st.value}</b>
                <small style={{ color: 'var(--soft)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>{st.label}</small>
              </div>
            ))}
          </div>

          {s!.recentExams.length > 0 && (
            <section className="content-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Latest attempts</p><h2>Recent exams</h2></div>
              </div>
              <div className="project-list">
                {s!.recentExams.map((exam) => {
                  const weekName = examWeeksData[exam.weekId]?.title || exam.weekId
                  return (
                    <article className="project" key={exam.id}>
                      <div className="project-main" style={{ cursor: 'default' }}>
                        <span className="cell-proj">
                          <span className="cell-name">{weekName}</span>
                          <small className="cell-sub">{new Date(exam.date).toLocaleDateString()}</small>
                        </span>
                        <span className="cell-side">
                          <span className="pxp">{exam.grade}<i>/100</i></span>
                          <span className={`pill ${RESULT_CLASS[exam.result] || 'st-locked'}`}>{exam.result}</span>
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {s!.examWeeks.length > 0 && (
            <section className="content-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Per week</p><h2>By exam week</h2></div>
              </div>
              <div className="rncp-grid">
                {s!.examWeeks.map((ew) => {
                  const weekName = examWeeksData[ew.weekId]?.title || ew.weekId
                  return (
                    <div key={ew.weekId} className="rncp-card">
                      <div className="rncp-card-head"><b>{weekName}</b></div>
                      <div className="rncp-card-meta">
                        <span>{ew.attempts} attempt{ew.attempts === 1 ? '' : 's'}</span>
                        <span>Best {ew.best}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

      <footer>
        <span>Piscine profile · synced with your account</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
