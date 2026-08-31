import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATEGORY_COLORS, byName, fmt, getProject, neighbors, projects, totalXp } from '@/lib/projects'

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) return { title: 'Project not found' }
  return {
    title: project.name,
    description: `${project.topic.slice(0, 150)} · ${fmt(project.xp)} XP · ${project.categories.join(', ')}`,
  }
}

const STATUS_CLASS: Record<string, string> = {
  Done: 'st-done',
  Available: 'st-avail',
  'Not recommended': 'st-notrec',
  'Unavailable (locked)': 'st-locked',
}

function RelChips({ names }: { names: string[] }) {
  if (!names.length) return <span className="rel-empty">None — this is a root project.</span>
  return (
    <div className="rel">
      {names.map((n) => {
        const target = byName(n)
        return target ? (
          <Link key={n} href={`/projects/${target.slug}`} className="relchip">{n}</Link>
        ) : (
          <span key={n} className="relchip relchip-muted">{n}</span>
        )
      })}
    </div>
  )
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  const { prev, next } = neighbors(slug)
  const related = projects.filter(
    (p) => p.id !== project.id && p.categories.some((c) => project.categories.includes(c)) && p.name !== project.name,
  ).slice(0, 8)

  return (
    <main className="app-shell">
      <nav className="floating-nav" aria-label="Main navigation" style={{ marginBottom: 0 }}>
        <Link href="/" className="isl-orb" aria-label="Back to home">
          <svg className="brand-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle className="brand-ring-track" cx="18" cy="18" r="16" />
            <circle className="brand-ring-prog" cx="18" cy="18" r="16" />
          </svg>
          <i>42</i>
        </Link>
        <div className="isl-mid">
          <b className="brand-text">curriculum map</b>
          <Link className="back-link" href="/projects" style={{ marginTop: 0 }}>
            All projects <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <header className="detail-hero">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow rise">42cursus / {project.isRoot ? 'root project' : 'branch project'}</p>
          <h1 className="rise" style={{ '--i': 1 } as React.CSSProperties}>{project.name}</h1>
          <div className="chip-row rise" style={{ '--i': 2 } as React.CSSProperties}>
            {project.categories.map((c) => (
              <span key={c} className={`cat-tag ${project.catInferred ? 'tag-inferred' : ''}`} style={{ color: CATEGORY_COLORS[c] ?? 'var(--soft)' }}>
                {c}{project.catInferred && <b className="infmark">?</b>}
              </span>
            ))}
            <span className={`pill ${STATUS_CLASS[project.status]}`}>{project.status}</span>
          </div>
        </div>
        <div className="detail-xp rise" style={{ '--i': 3 } as React.CSSProperties}>
          <strong>{fmt(project.xp)}</strong>
          <span>XP</span>
        </div>
      </header>

      <section className="detail-grid rise" style={{ '--i': 4 } as React.CSSProperties}>
        <div>
          <h4 className="side-label">Topic</h4>
          <p className="detail-topic">
            {project.topic.trim() || 'No public topic summary — this is an exam checkpoint, not a buildable project.'}
          </p>
        </div>

        <aside className="detail-side">
          <div className="stat-cell">
            <b>Experience</b>
            <strong>{fmt(project.xp)} XP</strong>
          </div>
          <div className="stat-cell">
            <b>Status</b>
            <strong>{project.status}</strong>
          </div>
          <div className="stat-cell">
            <b>Requires</b>
            <RelChips names={project.requires} />
          </div>
          <div className="stat-cell">
            <b>Unlocks</b>
            <RelChips names={project.unlocks} />
          </div>
          <div className="stat-cell">
            <b>Share of all curriculum XP</b>
            <div className="meter" style={{ width: '100%' }}>
              <i className="filled" style={{ '--pct': Math.max(0.02, project.xp / totalXp(projects)) } as React.CSSProperties} />
            </div>
          </div>
        </aside>
      </section>

      {related.length > 0 && (
        <section className="content-panel" style={{ paddingTop: 8 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Same field</p>
              <h2>Related projects</h2>
            </div>
            <span>{related.length} shown</span>
          </div>
          <div className="related">
            {related.map((p) => (
              <Link key={p.id} href={`/projects/${p.slug}`} className="project-main" style={{ borderBottom: '1px solid var(--rule)' }}>
                <span className="cell-proj">
                  <b className="cell-name">{p.isRoot && <i className="rootdot" />}{p.name}</b>
                  <small className="cell-sub">{p.status} · {fmt(p.xp)} XP</small>
                </span>
                <span className="pill-wrap"><span className={`pill ${STATUS_CLASS[p.status]}`}>{p.status}</span></span>
                <span className="path-arrow"><ArrowUpRight size={16} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="prevnext">
        {prev ? (
          <Link href={`/projects/${prev.slug}`}>
            <small>← Previous</small>
            <b>{prev.name}</b>
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/projects/${next.slug}`} className="pn-next">
            <small>Next →</small>
            <b>{next.name}</b>
          </Link>
        )}
      </div>

      <footer>
        <span>Source: 42 intra Holy Graph (42cursus)</span>
        <span>Made for the long way around.</span>
      </footer>

      <Link href="/" className="to-top show" aria-label="Back to home">
        <ArrowLeft size={17} />
      </Link>
    </main>
  )
}
