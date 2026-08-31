'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import NavIsland from '@/components/nav-island'
import ScrollBar from '@/components/scroll-bar'
import SkillMarquee from '@/components/skill-marquee'
import ToTop from '@/components/to-top'
import { CATEGORY_ORDER, fmt, projects, totalXp } from '@/lib/projects'

/* scroll reveal wrapper */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ '--d': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  )
}

/* animated counter */
function CountUp({ value, duration = 1300 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return
        started.current = true
        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration)
          setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        io.disconnect()
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])
  return <span ref={ref}>{fmt(display)}</span>
}

/* bar that animates when scrolled into view */
function Fill({ pct, className = '', style, children }: { pct: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
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
  const Tag = className.includes('xp-fill') ? ('span' as const) : ('i' as const)
  return (
    <Tag ref={ref as never} className={className} style={{ '--pct': pct, ...style } as CSSProperties}>
      {children}
    </Tag>
  )
}

/* ---------- engineered orbit diagram ---------- */
const CTR = 220
const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
const pt = (r: number, deg: number): [number, number] => [CTR + r * Math.cos(rad(deg)), CTR + r * Math.sin(rad(deg))]
function arcPath(r: number, a: number, b: number) {
  const [x1, y1] = pt(r, a)
  const [x2, y2] = pt(r, b)
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}
function wedgePath(r: number, a: number, b: number) {
  const [x1, y1] = pt(r, a)
  const [x2, y2] = pt(r, b)
  return `M ${CTR} ${CTR} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
}

function SatLabel({ r, deg, text, color }: { r: number; deg: number; text: string; color: string }) {
  const w = 16 + text.length * 8.5
  const [x, y] = pt(r, deg)
  return (
    <g className="orb-label">
      <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={3} fill="var(--paper)" stroke={color} strokeWidth={1} />
      <text x={x} y={y + 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" letterSpacing=".08em" fill="var(--ink)">
        {text}
      </text>
    </g>
  )
}

function OrbitDiagram() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
  const degrees = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg className="art-svg" viewBox="0 0 440 440" aria-hidden="true">
      <defs>
        <linearGradient
          id="sweep-grad"
          gradientUnits="userSpaceOnUse"
          x1={pt(204, -95)[0]}
          y1={pt(204, -95)[1]}
          x2={pt(204, -30)[0]}
          y2={pt(204, -30)[1]}
        >
          <stop offset="0" stopColor="#d7ff45" stopOpacity="0" />
          <stop offset=".82" stopColor="#d7ff45" stopOpacity=".2" />
        </linearGradient>
      </defs>

      <circle cx={CTR} cy={CTR} r={212} fill="none" stroke="var(--orbit-stroke)" strokeWidth="1.2" />
      {ticks.map((d) => {
        const major = d % 15 === 0
        const [x1, y1] = pt(major ? 197 : 202, d)
        const [x2, y2] = pt(209, d)
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--orbit-stroke)" strokeWidth={major ? 1.7 : 0.9} />
      })}
      {degrees.map((d) => {
        const [x, y] = pt(187, d)
        return (
          <text key={d} x={x} y={y + 3} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="rgba(245, 242, 236, .5)">
            {String(d).padStart(3, '0')}
          </text>
        )
      })}
      {[45, 135, 225, 315].map((d) => {
        const [x, y] = pt(212, d)
        return (
          <rect key={d} x={x - 3.5} y={y - 3.5} width="7" height="7" fill="none" stroke="var(--orbit-stroke)" strokeWidth="1.2" transform={`rotate(45 ${x} ${y})`} />
        )
      })}

      <g className="orb-spin" style={{ '--dur': '11s' } as CSSProperties}>
        <path d={wedgePath(204, -95, -30)} fill="url(#sweep-grad)" />
        <line x1={CTR} y1={CTR} {...(() => { const [x, y] = pt(204, -30); return { x2: x, y2: y } })()} stroke="#d7ff45" strokeWidth="1" opacity=".5" />
      </g>

      <circle cx={CTR} cy={CTR} r={160} fill="none" stroke="var(--orbit-stroke)" strokeWidth="1" strokeDasharray="2 7" />
      <g className="orb-spin" style={{ '--dur': '46s' } as CSSProperties}>
        <path d={arcPath(160, -113, -58)} className="trail" fill="none" stroke="var(--acid)" strokeWidth="1.6" opacity=".55" />
        <circle cx={pt(160, -58)[0]} cy={pt(160, -58)[1]} r={6.5} fill="var(--acid)" />
        <circle className="sat-halo" cx={pt(160, -58)[0]} cy={pt(160, -58)[1]} r={12} fill="none" stroke="var(--acid)" strokeWidth="1" opacity=".35" />
        <SatLabel r={160} deg={-58} text="C" color="var(--acid)" />
        <circle cx={pt(160, 132)[0]} cy={pt(160, 132)[1]} r={3.5} fill="var(--paper)" opacity=".85" />
      </g>

      <g className="orb-spin rev" style={{ '--dur': '32s' } as CSSProperties}>
        <path d={arcPath(120, -20, 25)} className="trail" fill="none" stroke="var(--coral)" strokeWidth="1.6" opacity=".55" />
        <path d={arcPath(120, 120, 165)} className="trail" fill="none" stroke="var(--violet)" strokeWidth="1.6" opacity=".55" />
        <circle cx={CTR} cy={CTR} r={120} fill="none" stroke="var(--orbit-stroke)" strokeWidth="1" strokeDasharray="10 6" />
        <circle cx={pt(120, 25)[0]} cy={pt(120, 25)[1]} r={6} fill="var(--coral)" />
        <SatLabel r={120} deg={25} text="C++" color="var(--coral)" />
        <circle cx={pt(120, 165)[0]} cy={pt(120, 165)[1]} r={6} fill="var(--violet)" />
        <SatLabel r={120} deg={165} text="UNIX" color="var(--violet)" />
      </g>

      <circle cx={CTR} cy={CTR} r={84} fill="none" stroke="var(--orbit-stroke)" strokeWidth="1" opacity=".7" />
      <g className="orb-spin" style={{ '--dur': '24s' } as CSSProperties}>
        <circle cx={pt(84, 80)[0]} cy={pt(84, 80)[1]} r={4} fill="var(--coral)" />
        <circle cx={pt(84, 205)[0]} cy={pt(84, 205)[1]} r={4} fill="var(--violet)" />
        <circle cx={pt(84, 320)[0]} cy={pt(84, 320)[1]} r={4} fill="var(--paper)" />
      </g>

      {[0, 90, 180, 270].map((d) => {
        const [x, y] = pt(66, d)
        return (
          <g key={d} stroke="var(--acid)" strokeWidth="1.4" opacity=".85">
            <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
            <line x1={x} y1={y - 5} x2={x} y2={y + 5} />
          </g>
        )
      })}
    </svg>
  )
}

export default function Page() {
  const done = projects.filter((p) => p.status === 'Done').length
  const avail = projects.filter((p) => p.status === 'Available').length
  const notrec = projects.filter((p) => p.status === 'Not recommended').length
  const locked = projects.filter((p) => p.status === 'Unavailable (locked)').length

  const xpByCat = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => {
        const items = projects.filter((p) => p.categories.includes(cat))
        return { cat, count: items.length, done: items.filter((p) => p.status === 'Done').length, xp: items.reduce((a, p) => a + p.xp, 0) }
      }),
    [],
  )
  const maxCatXp = useMemo(() => Math.max(...xpByCat.map((r) => r.xp)), [xpByCat])

  const topPaths = useMemo(
    () =>
      xpByCat
        .filter((r) => r.cat !== 'Core Curriculum' && r.cat !== 'Uncategorized' && r.count > 0)
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 3),
    [xpByCat],
  )

  return (
    <>
      <ScrollBar />

      <main className="app-shell" id="top">
        <NavIsland />

        {/* hero */}
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow rise">42 network · 42cursus / 2026</p>
            <h1>
              <span className="rise" style={{ '--i': 0, display: 'block' } as CSSProperties}>Find the</span>
              <em className="rise" style={{ '--i': 1, display: 'inline-block' } as CSSProperties}>next thing.</em>
            </h1>
            <p className="hero-sub rise" style={{ '--i': 2 } as CSSProperties}>
              Every project in the Holy Graph — its actual topic, specialty, XP value and status,
              cross-linked by prerequisite. Search by subject, not just name.
            </p>
            <Link href="/projects" className="primary-action rise" style={{ '--i': 3 } as CSSProperties}>
              Explore {projects.length} projects →
            </Link>
          </div>

          <div className="hero-art" role="img" aria-label="Orbital diagram of the 42 curriculum">
            <OrbitDiagram />
            <div className="core">
              <small>projects done</small>
              <strong><CountUp value={done} /></strong>
              <span>of {projects.length}</span>
            </div>
          </div>
        </section>

        {/* stats band */}
        <Reveal delay={100}>
          <section className="statband">
            <div className="sb-cell m-done"><strong><CountUp value={done} /></strong><span>Done</span></div>
            <div className="sb-cell m-avail"><strong><CountUp value={avail} /></strong><span>Available now</span></div>
            <div className="sb-cell m-notrec"><strong><CountUp value={notrec} /></strong><span>Not recommended</span></div>
            <div className="sb-cell m-locked"><strong><CountUp value={locked} /></strong><span>Locked</span></div>
            <div className="sb-cell sb-explored">
              <div className="sb-numrow">
                <strong>{Math.round((done / projects.length) * 100)}%</strong>
                <div className="meter sb-meter"><Fill pct={done / projects.length} /></div>
              </div>
              <span>Curriculum explored</span>
            </div>
          </section>
        </Reveal>

        {/* skills marquee */}
        <Reveal>
          <SkillMarquee />
        </Reveal>

        {/* biggest specialties */}
        <Reveal>
          <section className="content-panel" id="routes">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Choose a direction</p>
                <h2>Biggest specialties</h2>
              </div>
              <span>By total XP ↗</span>
            </div>
            <div className="path-grid">
              {topPaths.map((r, i) => (
                <Link
                  key={r.cat}
                  href={`/projects?cat=${encodeURIComponent(r.cat)}`}
                  className={`path-card path-${i}`}
                >
                  <span className="path-index">0{i + 1}</span>
                  <div>
                    <b>{r.cat}</b>
                    <small>{r.count} projects · {fmt(r.xp)} XP</small>
                  </div>
                  <span className="path-arrow">↗</span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        {/* xp analytics */}
        <Reveal>
          <section className="content-panel" id="analytics">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Where the weight is</p>
                <h2>XP by specialty</h2>
              </div>
              <span>{fmt(totalXp(projects))} XP total · click to explore</span>
            </div>
            <div className="xp-chart">
              {xpByCat.map((r, i) => (
                <Link
                  key={r.cat}
                  href={`/projects?cat=${encodeURIComponent(r.cat)}`}
                  className="xp-row"
                  title={`Explore ${r.cat}`}
                >
                  <span className="xp-row-label">{r.cat}</span>
                  <span className="xp-track">
                    <Fill
                      pct={maxCatXp ? r.xp / maxCatXp : 0}
                      className="xp-fill"
                      style={{ '--w': maxCatXp ? r.xp / maxCatXp : 0, '--i': i, '--o': 0.3 + 0.7 * (maxCatXp ? r.xp / maxCatXp : 0) } as CSSProperties}
                    />
                  </span>
                  <span className="xp-row-meta">
                    <b>{fmt(r.xp)} XP</b>
                    <small>{r.done}/{r.count} done</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        <footer>
          <span>Source: 42 intra Holy Graph (42cursus) · live snapshot from your account · {projects.length} projects</span>
          <span>Made for the long way around.</span>
        </footer>
      </main>

      <ToTop />
    </>
  )
}
