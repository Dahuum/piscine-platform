'use client'

import { GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { moduleOrder, modules, type Exercise } from '@/lib/piscine/modules'

// The exercise/module counts are static data — safe to compute during SSR.
// Which ones are marked "done" lives in localStorage, which doesn't exist on
// the server, so that part is deliberately kept out of the initial render
// (see the mount effect in PiscineHome below) rather than branched on
// `typeof window` here — branching would make the server's first render
// (always empty) disagree with the client's first render (real localStorage
// data), tripping a hydration mismatch instead of avoiding one.
function computeStaticTotal(): number {
  let total = 0
  moduleOrder.forEach((id) => {
    const mod = modules[id as keyof typeof modules]
    if (mod) total += mod.exercises.length
  })
  return total
}

function computeProgress() {
  const p: Record<string, number> = {}
  const c: Record<string, number> = {}
  let done = 0
  let total = 0
  moduleOrder.forEach((id) => {
    const mod = modules[id as keyof typeof modules]
    if (!mod) return
    let n = 0
    mod.exercises.forEach((ex: Exercise) => {
      total++
      if (localStorage.getItem(`progress:${mod.id}:${ex.id}`) === 'done') {
        n++
        done++
      }
    })
    c[id] = n
    p[id] = mod.exercises.length > 0 ? Math.round((n / mod.exercises.length) * 100) : 0
  })
  return { p, c, done, total }
}

/* animated bar, matches the rest of the site's .meter idiom */
function Fill({ pct }: { pct: number }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('filled')
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <span className="xp-track">
      <i ref={ref as never} className="xp-fill" style={{ '--w': pct, '--pct': pct } as CSSProperties} />
    </span>
  )
}

function ModuleRow({ id, progress, done, i }: { id: string; progress: number; done: number; i: number }) {
  const mod = modules[id as keyof typeof modules]
  if (!mod) return null
  return (
    <Link href={`/piscine/${mod.id}`} className="xp-row" title={mod.description}>
      <span className="xp-row-label">{mod.title}</span>
      <Fill pct={progress / 100} />
      <span className="xp-row-meta">
        <b>{progress}%</b>
        <small>{done}/{mod.exercises.length} done</small>
      </span>
    </Link>
  )
}

export default function PiscineHome() {
  const [{ p: progress, c: doneCounts, done: totalCompleted, total: totalExercises }, setProgress] = useState(() => ({
    p: {} as Record<string, number>,
    c: {} as Record<string, number>,
    done: 0,
    total: computeStaticTotal(),
  }))
  useEffect(() => {
    setProgress(computeProgress())
  }, [])
  const overallPct = totalExercises > 0 ? Math.round((totalCompleted / totalExercises) * 100) : 0
  const shellModules = moduleOrder.filter((id) => modules[id as keyof typeof modules]?.type === 'shell')
  const cModules = moduleOrder.filter((id) => modules[id as keyof typeof modules]?.type === 'c')

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <p className="eyebrow rise">42 Piscine · C fundamentals</p>
        <h1 className="rise" style={{ '--i': 1 } as CSSProperties}>Piscine</h1>
        <p className="rise" style={{ '--i': 2 } as CSSProperties}>
          Shell basics through C fundamentals — {totalExercises} exercises across {moduleOrder.length} modules,
          compiled and run in a real sandbox, not just linted.
        </p>
        <div className="dir-hero-stats rise" style={{ '--i': 3 } as CSSProperties}>
          <span><b>{totalCompleted}</b> done</span>
          <span><b>{totalExercises}</b> exercises</span>
          <span><b>{overallPct}%</b> complete</span>
        </div>
      </header>

      <section className="content-panel" style={{ paddingTop: 0 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Shell</p>
            <h2>Unix fundamentals</h2>
          </div>
        </div>
        <div className="xp-chart">
          {shellModules.map((id, i) => (
            <ModuleRow key={id} id={id} progress={progress[id] || 0} done={doneCounts[id] || 0} i={i} />
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">C</p>
            <h2>The language</h2>
          </div>
        </div>
        <div className="xp-chart">
          {cModules.map((id, i) => (
            <ModuleRow key={id} id={id} progress={progress[id] || 0} done={doneCounts[id] || 0} i={i} />
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="path-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Link href="/piscine/exam" className="path-card path-1 solo">
            <span className="path-index"><GraduationCap size={18} /></span>
            <div>
              <b>Exam Gate</b>
              <small>Timed exams, untimed practice mode, real pass/fail grading against reference solutions.</small>
            </div>
            <span className="path-arrow">↗</span>
          </Link>
        </div>
      </section>

      <footer>
        <span>42 Piscine · C fundamentals track</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
