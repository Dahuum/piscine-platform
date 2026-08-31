'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { fmt } from '@/lib/projects'
import {
  RNCP_CERTS,
  computeCoreCurriculum,
  computeOption,
  computeProExperience,
  computeSuite,
  type RncpCert,
  type RncpRef,
  type SuiteProgress,
} from '@/lib/rncp'

function usePersisted(key: string): [boolean, () => void] {
  const [val, setVal] = useState(false)
  useEffect(() => {
    try {
      setVal(localStorage.getItem(key) === '1')
    } catch {}
  }, [key])
  const toggle = () => {
    setVal((v) => {
      const next = !v
      try {
        localStorage.setItem(key, next ? '1' : '0')
      } catch {}
      return next
    })
  }
  return [val, toggle]
}

/* animated bar, matches the homepage/detail-page .meter idiom exactly */
function Meter({ pct }: { pct: number }) {
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
    <div className="meter">
      <i ref={ref as never} style={{ '--pct': pct } as CSSProperties} />
    </div>
  )
}

function ReqRow({
  label,
  hint,
  checked,
  onToggle,
  auto = false,
}: {
  label: string
  hint?: string
  checked: boolean
  onToggle?: () => void
  auto?: boolean
}) {
  return (
    <div className={`req-row ${checked ? 'checked' : ''}`}>
      <button
        type="button"
        className="req-check"
        aria-pressed={checked}
        aria-label={label}
        disabled={!onToggle}
        onClick={onToggle}
      >
        <Check size={12} strokeWidth={3} className="req-check-icon" />
      </button>
      <div className="req-copy">
        <span className="req-label">
          {label}
          {auto && <em className="req-auto">auto</em>}
        </span>
        {hint && <small className="req-hint">{hint}</small>}
      </div>
    </div>
  )
}

function RefChip({ r }: { r: RncpRef }) {
  if (r.deprecated) {
    return (
      <span className="relchip relchip-muted" title="Deprecated in the current curriculum — still counts if you validated it before removal.">
        {r.raw}
      </span>
    )
  }
  if (!r.project) {
    return (
      <span className="relchip relchip-muted" title={r.note ?? 'Not present in this account’s project snapshot.'}>
        {r.raw}
      </span>
    )
  }
  const done = r.project.status === 'Done'
  return (
    <Link
      href={`/projects/${r.project.slug}`}
      className={`relchip ${done ? 'relchip-done' : ''}`}
      title={r.note ?? r.project.status}
    >
      {done && '✓ '}
      {r.raw}
    </Link>
  )
}

function SuitePairRow({ s }: { s: SuiteProgress }) {
  return (
    <div className={`suite-pair ${s.met ? 'met' : ''}`}>
      <span className="suite-check"><Check size={11} strokeWidth={3} className="suite-check-icon" /></span>
      <RefChip r={s.sequelRef} />
      <span className="suite-arrow">follows</span>
      <RefChip r={s.predecessorRef} />
    </div>
  )
}

function ChoiceCard({ on, title, sub, onPick }: { on: boolean; title: string; sub: string; onPick: () => void }) {
  return (
    <button type="button" className={`choice-card ${on ? 'on' : ''}`} onClick={onPick} aria-pressed={on}>
      <span className="choice-check"><Check size={12} strokeWidth={3} /></span>
      <b>{title}</b>
      <small>{sub}</small>
    </button>
  )
}

export default function RncpGate() {
  const [certId, setCertId] = useState<RncpCert['id']>('rncp6')
  const cert = RNCP_CERTS.find((c) => c.id === certId) ?? RNCP_CERTS[0]

  const [optKey, setOptKey] = useState<string>(cert.options[0].key)
  const option = cert.options.find((o) => o.key === optKey) ?? cert.options[0]

  const pickCert = (id: RncpCert['id']) => {
    setCertId(id)
    setOptKey(RNCP_CERTS.find((c) => c.id === id)!.options[0].key)
  }

  /* restore ?cert=/?opt= via a mount effect (not useSearchParams) — avoids the
     Suspense boundary that Next 16.3's dev-mode streaming currently mishandles */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const c = sp.get('cert') === 'rncp7' ? 'rncp7' : 'rncp6'
    const targetCert = RNCP_CERTS.find((x) => x.id === c)!
    const o = sp.get('opt')
    setCertId(c)
    setOptKey(targetCert.options.some((x) => x.key === o) ? o! : targetCert.options[0].key)
  }, [])

  const optionProgress = useMemo(() => computeOption(option), [option])
  const suite = useMemo(() => computeSuite(), [])
  const suiteHit = suite.find((s) => s.met)
  const proExp = useMemo(() => computeProExperience(), [])
  const core = useMemo(() => computeCoreCurriculum(), [])

  const [commonCore, toggleCommonCore] = usePersisted('rncp:commonCore')
  const [groupProjects, toggleGroupProjects] = usePersisted('rncp:groupProjects')
  const [levelReached, toggleLevel] = usePersisted(`rncp:level:${certId}`)
  const [eventsAttended, toggleEvents] = usePersisted(`rncp:events:${certId}`)

  const gateMet = commonCore && groupProjects && levelReached && eventsAttended && proExp.met && Boolean(suiteHit) && optionProgress.met

  const missing = useMemo(() => {
    const list: string[] = []
    if (!commonCore) list.push('Confirm the common core is validated.')
    if (!groupProjects) list.push('Confirm 2 post-common-core group projects are validated.')
    if (!levelReached) list.push(`Confirm level ${cert.level} is reached.`)
    if (!eventsAttended) list.push(`Confirm ${cert.events} pedagogical events attended.`)
    if (!proExp.met) list.push('Validate 2 full-time professional experiences (Work Experience I & II, or Startup Experience).')
    if (!suiteHit) list.push('Validate one "Suite" sequel project — any one of the ten pairs below.')
    optionProgress.categories.forEach((cp) => {
      if (!cp.met) {
        list.push(
          `${cp.category.name}: reach ${fmt(cp.category.minXp)} XP and ${cp.category.minProjects} projects — you're at ${cp.doneXp.toLocaleString('en-US')} XP, ${cp.doneCount} project${cp.doneCount === 1 ? '' : 's'}.`,
        )
      }
    })
    return list
  }, [commonCore, groupProjects, levelReached, eventsAttended, proExp, suiteHit, optionProgress, cert])

  return (
    <div key={certId}>
      <section className="content-panel" style={{ paddingTop: 0 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Certificates</p>
            <h2>Choose your track</h2>
          </div>
        </div>
        <div className="choice-grid">
          {RNCP_CERTS.map((c) => (
            <ChoiceCard
              key={c.id}
              on={c.id === certId}
              title={c.label}
              sub={`${c.degree} · ${c.years}-year track`}
              onPick={() => pickCert(c.id)}
            />
          ))}
        </div>
        <p className="rncp-lede">Both are optional diplomas layered on top of the cursus — clearing one adds a legal credential, it doesn&apos;t replace alumni status.</p>
      </section>

      <section className="content-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{cert.label} · {cert.degree}</p>
            <h2>What it takes</h2>
          </div>
          <span>{cert.codes.join(' · ')}</span>
        </div>
        <p className="rncp-lede">
          Level, events and enrollment aren&apos;t in this dataset, so those four you confirm yourself — it&apos;s saved in this browser. The two marked <em className="req-auto req-auto-inline">auto</em> are read live from your projects.
        </p>
        <div className="rncp-checklist">
          <ReqRow
            label="Common core validated"
            hint={`for reference: ${core.done}/${core.total} Core Curriculum projects done`}
            checked={commonCore}
            onToggle={toggleCommonCore}
          />
          <ReqRow
            label="2 post-common-core group projects"
            checked={groupProjects}
            onToggle={toggleGroupProjects}
          />
          <ReqRow label={`Level ${cert.level} reached`} checked={levelReached} onToggle={toggleLevel} />
          <ReqRow label={`${cert.events} pedagogical events attended`} checked={eventsAttended} onToggle={toggleEvents} />
          <ReqRow
            label="2 full-time professional experiences"
            hint={
              proExp.doneCount
                ? `matched: ${proExp.refs.filter((r) => r.project?.status === 'Done').map((r) => r.raw).join(', ')}`
                : 'none of Work Experience I/II or Startup Experience done yet'
            }
            checked={proExp.met}
            auto
          />
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Common to both certificates</p>
            <h2>One &quot;Suite&quot; project</h2>
          </div>
        </div>
        <p className="rncp-lede">
          A Suite project is a sequel to a Common Core project — 42sh, for example, follows minishell. Finishing any
          one of these ten pairs clears it.
        </p>
        <div className="rncp-suite-grid">
          {suite.map((s) => (
            <SuitePairRow key={s.sequel} s={s} />
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{cert.label}</p>
            <h2>Choose your specialty</h2>
          </div>
        </div>
        <div className="choice-grid">
          {cert.options.map((o) => (
            <ChoiceCard
              key={o.key}
              on={o.key === optKey}
              title={o.name}
              sub={`${o.categories.length} categories to clear`}
              onPick={() => setOptKey(o.key)}
            />
          ))}
        </div>
        <p className="rncp-lede">Two independent routes to the same title — clear every category in one, you never need both.</p>
      </section>

      <section className="content-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{option.name}</p>
            <h2>Category requirements</h2>
          </div>
        </div>
        <p className="rncp-legend">
          <span><i className="lg-sw lg-sw-done" />done, counted</span>
          <span><i className="lg-sw lg-sw-open" />not done yet</span>
          <span><i className="lg-sw lg-sw-muted" />not in your snapshot</span>
        </p>
        <div className="rncp-grid">
          {optionProgress.categories.map((cp, i) => (
            <article key={cp.category.key} className="rncp-card stagger-item" style={{ '--i': i } as CSSProperties}>
              <div className="rncp-card-head">
                <b>{cp.category.name}</b>
                {cp.met && <span className="rncp-met">Met</span>}
              </div>
              <Meter pct={cp.xpPct} />
              <div className="rncp-card-meta">
                <span>{fmt(cp.doneXp)} / {fmt(cp.category.minXp)} XP</span>
                <span>{cp.doneCount}/{cp.category.minProjects} projects</span>
              </div>
              <div className="rncp-proj-chips">
                {cp.refs.map((r, j) => (
                  <RefChip key={`${r.raw}-${j}`} r={r} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel rncp-result">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">So, where does that leave you?</p>
            <h2 className={gateMet ? 'text-good' : ''}>{gateMet ? `${cert.label} gate cleared` : `${cert.label}: not yet eligible`}</h2>
          </div>
          <span>for {option.name}</span>
        </div>
        {missing.length > 0 && (
          <ul className="rncp-missing">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </section>

      <details className="rncp-legacy">
        <summary>Legacy &amp; renamed projects still count</summary>
        <p>
          Older or renamed projects no longer in the live curriculum — retired web/mobile piscines, the
          pre-Suite versions of 42sh, RT, HumanGL and kfs-2, and a handful of removed AI modules — still
          satisfy these requirements if they were validated before being replaced.
        </p>
      </details>
    </div>
  )
}
