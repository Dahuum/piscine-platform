import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="app-shell">
      <div className="nf-shell">
        <p className="eyebrow rise">Lost in the curriculum</p>
        <h1 className="nf-code rise" style={{ '--i': 1 } as React.CSSProperties}>404</h1>
        <p className="nf-sub rise" style={{ '--i': 2 } as React.CSSProperties}>
          This page hasn&apos;t been pushed to the repo yet.
        </p>
        <Link href="/" className="primary-action rise" style={{ '--i': 3, justifyContent: 'center' } as React.CSSProperties}>
          <ArrowLeft /> Back to the map
        </Link>
      </div>
    </main>
  )
}
