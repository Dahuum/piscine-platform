import type { Metadata } from 'next'
import NavIsland from '@/components/nav-island'
import RncpGate from '@/components/rncp-gate'
import ToTop from '@/components/to-top'

export const metadata: Metadata = {
  title: 'RNCP gate',
  description: 'Track your account against the RNCP 6 and RNCP 7 homologated certificate requirements, computed live from your project snapshot.',
}

export default function RncpPage() {
  return (
    <main className="app-shell" id="top">
      <NavIsland />

      <header className="dir-hero">
        <p className="eyebrow rise">42 network · France Compétences</p>
        <h1 className="rise" style={{ '--i': 1 } as React.CSSProperties}>RNCP gate</h1>
        <p className="rise" style={{ '--i': 2 } as React.CSSProperties}>
          Two state-homologated certificates sit on top of the curriculum. Pick a track and an option
          to see exactly which requirements your account already clears, computed live from the project
          snapshot — and which ones are still up to you to confirm.
        </p>
      </header>

      <RncpGate />

      <footer>
        <span>Requirement structure: 42 Paris RNCP 6/7 meta articles · progress: live snapshot from your account</span>
        <span>Made for the long way around.</span>
      </footer>
      <ToTop />
    </main>
  )
}
