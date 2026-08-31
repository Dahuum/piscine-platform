'use client'

import { ArrowLeft, Check, Lock } from 'lucide-react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { modules, type Exercise, type Module } from '@/lib/piscine/modules'

export default function ModulePage() {
  const params = useParams<{ module: string }>()
  const mod = modules[params.module as keyof typeof modules]
  if (!mod) notFound()
  // Remount on module change — navigating between modules doesn't reload
  // the page, so without this the completed-exercises list would need an
  // effect to re-sync instead of a plain initializer.
  return <ModulePageInner key={mod.id} mod={mod} />
}

function ModulePageInner({ mod }: { mod: Module }) {
  // Starts empty so the server render (no localStorage) and the client's
  // first render agree — filled in by the effect below right after mount,
  // rather than branching on `typeof window` in the initializer, which
  // would make the client's first render disagree with the server's and
  // trip a hydration mismatch whenever any exercise is already done.
  const [completed, setCompleted] = useState<string[]>([])
  useEffect(() => {
    setCompleted(mod.exercises.filter((ex: Exercise) => localStorage.getItem(`progress:${mod.id}:${ex.id}`) === 'done').map((ex: Exercise) => ex.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod.id])
  const total = mod.exercises.length
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0

  const isUnlocked = (index: number) => {
    if (index === 0) return true
    return completed.includes(mod.exercises[index - 1].id)
  }

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <Link href="/piscine" className="back-link" style={{ marginTop: 0 }}>
          <ArrowLeft size={13} /> All modules
        </Link>
        <p className="eyebrow rise" style={{ '--i': 1 } as CSSProperties}>{mod.type === 'shell' ? 'Shell' : 'C'} module</p>
        <h1 className="rise" style={{ '--i': 2 } as CSSProperties}>{mod.title}</h1>
        <p className="rise" style={{ '--i': 3 } as CSSProperties}>{mod.summary}</p>
        <div className="dir-hero-stats rise" style={{ '--i': 4 } as CSSProperties}>
          <span><b>{completed.length}</b>/{total} done</span>
          <span><b>{pct}%</b> complete</span>
        </div>
      </header>

      <div className="project-list">
        {mod.exercises.map((ex: Exercise, index: number) => {
          const isDone = completed.includes(ex.id)
          const unlocked = isUnlocked(index)
          return (
            <article className={`project stagger-item ${!unlocked ? 'ex-locked' : ''}`} key={ex.id} style={{ '--i': Math.min(index, 16) } as CSSProperties}>
              <Link href={unlocked ? `/piscine/${mod.id}/${ex.id}` : '#'} className="project-main" style={{ cursor: unlocked ? 'pointer' : 'default' }}>
                <span className="cell-proj">
                  <span className="cell-name">
                    {isDone && <Check size={13} strokeWidth={3} style={{ color: 'var(--teal)', marginRight: 6 }} />}
                    Ex {String(ex.number).padStart(2, '0')} — {ex.title}
                  </span>
                  {'prototype' in ex && <small className="cell-sub">{(ex as { prototype?: string }).prototype}</small>}
                </span>
                <span className="cell-side">
                  {isDone && <span className="pill st-done">Done</span>}
                  {!unlocked && <Lock size={14} color="var(--soft)" />}
                </span>
              </Link>
            </article>
          )
        })}
      </div>

      <footer>
        <span>Compiled with {mod.type === 'shell' ? '/bin/sh' : 'gcc'} in a sandboxed environment.</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
