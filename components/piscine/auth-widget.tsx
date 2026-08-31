'use client'

import { LogOut, User } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { setCachedUserId } from '@/lib/piscine/db'
import { detectExistingData, markMigrationHandled } from '@/lib/piscine/migrate-data'
import { hydrateFromCloud } from '@/lib/piscine/hydrate-data'
import MigrationModal from './migration-modal'

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmSent, setConfirmSent] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }
      onClose()
      return
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/piscine/auth/confirm` },
    })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    setLoading(false)
    if (data.user && !data.session) {
      setConfirmSent(true)
      return
    }
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {confirmSent ? (
          <div className="modal-center">
            <div className="modal-icon good"><User size={20} /></div>
            <h2>Check your email</h2>
            <p className="modal-sub">
              We sent a confirmation link to <b style={{ color: 'var(--ink)' }}>{email}</b>. Click it to activate your
              account — you&apos;ll come back here signed in.
            </p>
            <button className="modal-submit" onClick={onClose}>Got it</button>
          </div>
        ) : (
          <>
            <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
            <p className="modal-sub">Sync your Piscine progress across devices.</p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="modal-field"
                autoFocus
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="modal-field"
              />
              {error && <p className="modal-error">{error}</p>}
              <button type="submit" className="modal-submit" disabled={loading}>
                {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <p className="modal-switch">
              {mode === 'login' ? "No account? " : 'Already registered? '}
              <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function AuthWidget() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [open, setOpen] = useState(false)
  const [showMigration, setShowMigration] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))

    let migrationShown = false
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        // lib/piscine/db.ts keeps its own independent onAuthStateChange
        // subscription to cache the user id for every DB read/write, with no
        // ordering guarantee relative to this one — seed it directly so
        // hydration below never depends on that race resolving first.
        setCachedUserId(session.user.id)
        if (!migrationShown) {
          migrationShown = true
          const userId = session.user.id
          const pendingFlag = `migration-pending:${userId}`
          if (sessionStorage.getItem(pendingFlag)) {
            sessionStorage.removeItem(pendingFlag)
            setTimeout(() => setShowMigration(true), 600)
          } else {
            const { hasData } = detectExistingData(userId)
            hydrateFromCloud().then((wrote) => {
              if (wrote) {
                if (hasData) {
                  sessionStorage.setItem(pendingFlag, '1')
                } else {
                  markMigrationHandled(userId)
                }
                window.location.reload()
              } else if (hasData) {
                setTimeout(() => setShowMigration(true), 600)
              }
            })
          }
        }
      } else {
        setUser(null)
        migrationShown = false
        setCachedUserId(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleLogout = () => createClient().auth.signOut().then(() => setUser(null))

  if (!mounted) return <span className="auth-trigger" aria-hidden />

  if (!user) {
    return (
      <>
        <button className="auth-trigger" onClick={() => setOpen(true)} aria-label="Sign in">
          <User />
        </button>
        {open && createPortal(<AuthModal onClose={() => setOpen(false)} />, document.body)}
      </>
    )
  }

  return (
    <>
      <div className="auth-user">
        <Link href="/piscine/profile" className="isl-avatar" title={user.email}>
          {(user.email || '?')[0].toUpperCase()}
        </Link>
        <button className="auth-trigger" onClick={handleLogout} aria-label="Log out">
          <LogOut />
        </button>
      </div>
      {showMigration &&
        createPortal(<MigrationModal userId={user.id} onComplete={() => setShowMigration(false)} />, document.body)}
    </>
  )
}
