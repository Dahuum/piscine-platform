import type { Metadata } from 'next'
import Directory from '@/components/directory'
import NavIsland from '@/components/nav-island'
import ToTop from '@/components/to-top'
import { fmt, projects, totalXp } from '@/lib/projects'

export const metadata: Metadata = {
  title: 'All projects',
  description: `Browse all ${projects.length} projects of the 42 curriculum — search, filter, and sort by XP, status, and specialty.`,
}

export default function ProjectsPage() {
  const done = projects.filter((p) => p.status === 'Done').length
  const avail = projects.filter((p) => p.status === 'Available').length

  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <p className="eyebrow rise">The full index · Holy Graph snapshot</p>
        <h1 className="rise" style={{ '--i': 1 } as React.CSSProperties}>All projects</h1>
        <p className="rise" style={{ '--i': 2 } as React.CSSProperties}>
          Every project beyond Common Core — its actual topic, specialty, XP value and status,
          cross-linked by prerequisite. Search by subject, not just name.
        </p>
        <div className="dir-hero-stats rise" style={{ '--i': 3 } as React.CSSProperties}>
          <span><b>{projects.length}</b> projects</span>
          <span><b>{fmt(totalXp(projects))}</b> XP total</span>
          <span><b>{done}</b> done</span>
          <span><b>{avail}</b> available now</span>
        </div>
      </header>

      <Directory />

      <footer>
        <span>Source: 42 intra Holy Graph (42cursus) · live snapshot from your account · {projects.length} projects</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
