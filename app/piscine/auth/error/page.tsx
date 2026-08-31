import { ArrowLeft, TriangleAlert } from 'lucide-react'
import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="app-shell">
      <div className="nf-shell">
        <div className="modal-icon" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}>
          <TriangleAlert size={20} />
        </div>
        <p className="eyebrow rise">Link expired or already used</p>
        <p className="nf-sub rise" style={{ '--i': 1 } as React.CSSProperties}>
          That confirmation link is no longer valid — try signing up or signing in again to get a fresh one.
        </p>
        <Link href="/piscine" className="primary-action rise" style={{ '--i': 2, justifyContent: 'center' } as React.CSSProperties}>
          <ArrowLeft /> Back to Piscine
        </Link>
      </div>
    </main>
  )
}
