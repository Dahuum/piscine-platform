'use client'

import { ChevronRight, Clock, Monitor, Terminal, Trophy, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { getExamHistory } from '@/lib/piscine/db'

type LevelEntry = { level: number; exercise: string; passed: boolean; attempts: number }
type HistoryEntry = { id: string; weekId: string; mode: string; startedAt: number; endedAt: number; duration: number; result: string; finalGrade: number; levels: LevelEntry[] }

const WEEK_LABELS: Record<string, string> = { exam_01: 'Exam Week 01', exam_02: 'Exam Week 02', exam_03: 'Exam Week 03', exam_04: 'Exam Week 04' }
const RESULT_CLASS: Record<string, string> = { completed: 'st-done', timeout: 'st-notrec', abandoned: 'st-locked' }

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ExamHistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const dbHistory = await getExamHistory()
        if (dbHistory.length > 0) {
          setHistory(dbHistory as HistoryEntry[])
          return
        }
      } catch {}
      try {
        const raw = localStorage.getItem('exam:history')
        if (raw) setHistory(JSON.parse(raw))
      } catch {}
    })()
  }, [])

  const weekIds = useMemo(() => [...new Set(history.map((h) => h.weekId))], [history])
  const filtered = filter === 'all' ? history : history.filter((h) => h.weekId === filter)

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <Link href="/piscine/exam" className="back-link" style={{ marginTop: 0 }}>← Exam Gate</Link>
        <h1 className="rise" style={{ '--i': 1 } as CSSProperties}>Exam history</h1>
        <p className="rise" style={{ '--i': 2 } as CSSProperties}>All your past exam attempts, graded and archived.</p>
      </header>

      {history.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <b>No attempts yet</b>
          <Link href="/piscine/exam" className="detail-link" style={{ justifyContent: 'center', marginTop: 8 }}>Take your first exam →</Link>
        </div>
      ) : (
        <>
          <div className="dir-filters" style={{ marginTop: 20 }}>
            {['all', ...weekIds].map((w) => (
              <button key={w} className={`chip ${filter === w ? 'on' : ''}`} onClick={() => setFilter(w)}>
                {w === 'all' ? 'All' : WEEK_LABELS[w] || w}
              </button>
            ))}
          </div>

          <div className="project-list">
            {filtered.map((entry, i) => {
              const isOpen = expandedId === entry.id
              const passedCount = entry.levels.filter((l) => l.passed).length
              return (
                <article className={`project stagger-item ${isOpen ? 'expanded' : ''}`} key={entry.id} style={{ '--i': Math.min(i, 16) } as CSSProperties}>
                  <button className="project-main" onClick={() => setExpandedId(isOpen ? null : entry.id)} aria-expanded={isOpen}>
                    <span className="cell-proj">
                      <span className="cell-name">
                        {entry.result === 'completed' ? <Trophy size={13} color="var(--teal)" style={{ marginRight: 6 }} /> : entry.result === 'timeout' ? <Clock size={13} color="var(--gold)" style={{ marginRight: 6 }} /> : <XCircle size={13} color="var(--soft)" style={{ marginRight: 6 }} />}
                        {WEEK_LABELS[entry.weekId] || entry.weekId}
                      </span>
                      <small className="cell-sub">
                        {entry.mode === 'editor' ? <Monitor size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} /> : <Terminal size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />}
                        {formatDate(entry.startedAt)} · {formatTime(entry.duration)} · {passedCount}/{entry.levels.length} levels
                      </small>
                    </span>
                    <span className="cell-side">
                      <span className="pxp">{entry.finalGrade}<i>/100</i></span>
                      <span className={`pill ${RESULT_CLASS[entry.result] || 'st-locked'}`}>{entry.result}</span>
                    </span>
                    <span className="caret"><ChevronRight size={16} /></span>
                  </button>
                  <div className={`acc ${isOpen ? 'open' : ''}`}>
                    <div className="acc-inner">
                      <div className="project-detail">
                        <h4>Level breakdown</h4>
                        <div className="rel">
                          {entry.levels.map((lvl) => (
                            <span key={lvl.level} className={`relchip ${lvl.passed ? 'relchip-done' : ''}`} title={`${lvl.attempts} attempt${lvl.attempts > 1 ? 's' : ''}`}>
                              {lvl.passed ? '✓ ' : '✕ '}L{lvl.level} {lvl.exercise}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      <footer>
        <span>Exam Gate · attempt archive</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
