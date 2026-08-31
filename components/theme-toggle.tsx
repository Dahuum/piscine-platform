'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getTheme, saveTheme } from '@/lib/piscine/db'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  // A logged-in Piscine account's saved theme preference (user_settings
  // table) takes over from whatever localStorage/system-preference picked
  // on first paint — async, so this never fights the synchronous initial
  // render above; it just no-ops if nobody's signed in.
  useEffect(() => {
    getTheme()
      .then((t) => {
        if (t === 'dark' || t === 'light') {
          setTheme(t)
          document.documentElement.setAttribute('data-theme', t)
          localStorage.setItem('theme', t)
        }
      })
      .catch(() => {})
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    saveTheme(next).catch(() => {})
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  )
}
