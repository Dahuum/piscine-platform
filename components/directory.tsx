'use client'

import { ChevronRight, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  STATUS_ORDER,
  byName,
  fmt,
  projects,
  type Status,
} from '@/lib/projects'

const STATUSES: Status[] = ['Done', 'Available', 'Not recommended', 'Unavailable (locked)']
const STATUS_CLASS: Record<Status, string> = {
  Done: 'st-done',
  Available: 'st-avail',
  'Not recommended': 'st-notrec',
  'Unavailable (locked)': 'st-locked',
}
type SortKey = 'name' | 'xp-desc' | 'xp-asc' | 'status'

const SORTS: [SortKey, string][] = [
  ['name', 'A–Z'],
  ['xp-desc', 'XP ↓'],
  ['xp-asc', 'XP ↑'],
  ['status', 'Status'],
]

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

export default function Directory() {
  const [query, setQuery] = useState('')
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Set<Status>>(new Set())
  const [sort, setSort] = useState<SortKey>('name')
  const [open, setOpen] = useState<number | null>(null)
  const [pendingJump, setPendingJump] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const toggleCat = (c: string) => {
    const next = new Set(cats)
    next.has(c) ? next.delete(c) : next.add(c)
    setCats(next)
  }
  const toggleStatus = (s: Status) => {
    const next = new Set(statuses)
    next.has(s) ? next.delete(s) : next.add(s)
    setStatuses(next)
  }
  const reset = () => {
    setQuery('')
    setCats(new Set())
    setStatuses(new Set())
    setOpen(null)
  }

  /* restore ?cat= via a mount effect (not useSearchParams) — avoids the Suspense
     boundary that Next 16.3's dev-mode streaming currently mishandles */
  useEffect(() => {
    const initialCat = new URLSearchParams(window.location.search).get('cat')
    if (initialCat && CATEGORY_ORDER.includes(initialCat)) setCats(new Set([initialCat]))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.topic.toLowerCase().includes(q)) return false
      if (cats.size && !p.categories.some((c) => cats.has(c))) return false
      if (statuses.size && !statuses.has(p.status)) return false
      return true
    })
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'xp-desc') sorted.sort((a, b) => b.xp - a.xp)
    if (sort === 'xp-asc') sorted.sort((a, b) => a.xp - b.xp)
    if (sort === 'status') sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name))
    return sorted
  }, [query, cats, statuses, sort])

  const catCounts = useMemo(
    () => CATEGORY_ORDER.map((c) => ({ c, n: projects.filter((p) => p.categories.includes(c)).length })).filter((x) => x.n),
    [],
  )
  const statusCounts = useMemo(
    () => STATUSES.map((s) => ({ s, n: projects.filter((p) => p.status === s).length })),
    [],
  )

  /* keyboard shortcuts: "/" focuses search, Escape resets */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* jump-to-project from prerequisite/unlock chips */
  useEffect(() => {
    if (pendingJump == null) return
    const el = document.getElementById(`proj-${pendingJump}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setPendingJump(null)
  }, [pendingJump, query, cats, statuses])

  const jumpTo = (name: string) => {
    const target = byName(name)
    setQuery('')
    setCats(new Set())
    setStatuses(new Set())
    setOpen(target ? target.id : null)
    if (target) setPendingJump(target.id)
  }

  const hasFilters = Boolean(query) || cats.size > 0 || statuses.size > 0
  const listKey = `${query}|${[...cats].join(',')}|${[...statuses].join(',')}|${sort}`

  return (
    <section className="directory">
      {/* sticky control bar */}
      <div className="dir-controls">
        <label className="dir-search">
          <Search size={15} />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search by name or topic — "kernel", "neural", "raytracing"'
          />
          <kbd className="hint">/</kbd>
        </label>
        <div className="dir-sort" role="group" aria-label="Sort projects">
          {SORTS.map(([key, label]) => (
            <button key={key} className={sort === key ? 'selected' : ''} onClick={() => setSort(key)}>
              {label}
            </button>
          ))}
        </div>
        <span className="dir-count">{visible.length}/{projects.length}</span>
        {hasFilters && (
          <button className="dir-reset" onClick={reset} aria-label="Reset filters">
            <X size={14} /> Reset
          </button>
        )}
      </div>

      {/* filters */}
      <div className="dir-filters">
        {catCounts.map(({ c, n }) => (
          <button key={c} className={`chip ${cats.has(c) ? 'on' : ''}`} onClick={() => toggleCat(c)} aria-pressed={cats.has(c)}>
            {c}
            <span className="n">{n}</span>
          </button>
        ))}
      </div>
      <div className="dir-filters" style={{ marginBottom: 18 }}>
        {statusCounts.map(({ s, n }) => (
          <button key={s} className={`chip ${statuses.has(s) ? 'on' : ''}`} onClick={() => toggleStatus(s)} aria-pressed={statuses.has(s)}>
            <i className={`dot dot-${STATUS_CLASS[s]}`} />
            {s}
            <span className="n">{n}</span>
          </button>
        ))}
      </div>

      {/* list */}
      <div className="project-list" key={listKey}>
        {visible.length === 0 && (
          <div className="empty-state">
            <b>No projects match these filters</b>
            Try a different search or hit Escape to reset.
          </div>
        )}
        {visible.map((p, i) => {
          const isOpen = open === p.id
          const topic = p.topic.trim() || 'No public topic summary — this is an exam checkpoint, not a buildable project.'
          return (
            <article id={`proj-${p.id}`} className={`project stagger-item ${isOpen ? 'expanded' : ''}`} key={p.id} style={{ '--i': Math.min(i, 16) } as CSSProperties}>
              <button className="project-main" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                <span className="cell-proj">
                  <span className="cell-name">
                    {p.isRoot && <i className="rootdot" title="Root project — no prerequisite beyond Common Core" />}
                    {p.name}
                  </span>
                  <small className="cell-sub">{truncate(topic, 110)}</small>
                  <span className="cell-tags">
                    {p.categories.map((c) => (
                      <span
                        key={c}
                        className={`cat-tag ${p.catInferred ? 'tag-inferred' : ''}`}
                        style={{ color: CATEGORY_COLORS[c] ?? 'var(--soft)' }}
                        title={p.catInferred ? 'Best-guess tag from the topic — not an official 42 layer' : 'Official 42 layer tag'}
                      >
                        {c}{p.catInferred && <b className="infmark">?</b>}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="cell-side">
                  <span className="pxp">{fmt(p.xp)} <i>XP</i></span>
                  <span className={`pill ${STATUS_CLASS[p.status]}`}>{p.status}</span>
                </span>
                <span className="caret"><ChevronRight size={16} /></span>
              </button>
              <div className={`acc ${isOpen ? 'open' : ''}`}>
                <div className="acc-inner">
                  <div className="project-detail">
                    <h4>Topic</h4>
                    <p>{topic}</p>
                    <div className="rel-grid">
                      <div>
                        <h4>Requires (prerequisite of)</h4>
                        <div className="rel">
                          {p.requires.length ? p.requires.map((n) => (
                            <button key={n} className="relchip" onClick={(e) => { e.stopPropagation(); jumpTo(n) }}>{n}</button>
                          )) : <span className="rel-empty">None — root project.</span>}
                        </div>
                      </div>
                      <div>
                        <h4>Unlocks (leads to)</h4>
                        <div className="rel">
                          {p.unlocks.length ? p.unlocks.map((n) => (
                            <button key={n} className="relchip" onClick={(e) => { e.stopPropagation(); jumpTo(n) }}>{n}</button>
                          )) : <span className="rel-empty">Nothing listed.</span>}
                        </div>
                      </div>
                    </div>
                    <Link href={`/projects/${p.slug}`} className="detail-link">Open project page →</Link>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
