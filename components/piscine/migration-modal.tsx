'use client'

import { CheckCircle2, Database, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getLocalDataSummary, markMigrationHandled, migrateAllData } from '@/lib/piscine/migrate-data'

export default function MigrationModal({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [summary] = useState(() => (typeof window !== 'undefined' ? getLocalDataSummary() : []))

  const handleImport = async () => {
    setLoading(true)
    setError('')
    try {
      await migrateAllData()
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Migration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    markMigrationHandled(userId)
    onComplete()
  }

  return (
    <div className="modal-backdrop" onClick={done ? onComplete : undefined}>
      <div className="modal-card modal-center" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <div className="modal-icon good"><CheckCircle2 size={22} /></div>
            <h2>Data imported</h2>
            <p className="modal-sub">All your progress is now saved to your account — pick it up from any device.</p>
            <button className="modal-submit" onClick={onComplete}>Continue</button>
          </>
        ) : (
          <>
            <div className="modal-icon"><Database size={20} /></div>
            <h2>We found your progress</h2>
            <p className="modal-sub">You used this device before signing in. Import it to your account, or start fresh.</p>
            {summary.length > 0 && (
              <div className="modal-summary">
                {summary.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            )}
            {error && <p className="modal-error">{error}</p>}
            <button className="modal-submit" onClick={handleImport} disabled={loading}>
              {loading ? 'Importing…' : 'Import to my account'}
            </button>
            <button className="modal-ghost" onClick={handleSkip} disabled={loading}>
              <Trash2 size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
              Start fresh — don&apos;t import
            </button>
          </>
        )}
      </div>
    </div>
  )
}
