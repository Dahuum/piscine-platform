'use client'

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
} from 'motion/react'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from '@/components/theme-toggle'
import AuthWidget from '@/components/piscine/auth-widget'

const SECTIONS = ['top', 'routes', 'directory']

const EXPANDED = { w: 920, h: 56, r: 28 }
const COMPACT = { w: 96, h: 48, r: 24 }
const PEEK_W = 124

/* direction-aware physics: shut = critically damped snap, open = visible overshoot */
const SPRING_OPEN = { type: 'spring' as const, stiffness: 480, damping: 24, mass: 0.9 }
const SPRING_SHUT = { type: 'spring' as const, stiffness: 900, damping: 62, mass: 0.8 }
const SPRING_PEEK = { type: 'spring' as const, stiffness: 620, damping: 44 }

/* self-contained dynamic island: real spring physics at native refresh rate */
export default function NavIsland() {
  const reduce = useReducedMotion()
  const pathname = usePathname()
  const onHome = pathname === '/'
  const navRef = useRef<HTMLElement>(null)
  const [mode, setMode] = useState<'expanded' | 'compact'>('expanded')
  const [active, setActive] = useState('top')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const activeId = pathname === '/projects' ? 'directory' : pathname === '/rncp' ? 'rncp' : pathname.startsWith('/piscine') ? 'piscine' : active
  const modeRef = useRef<'expanded' | 'compact'>('expanded')
  const lastY = useRef(0)
  const hover = useRef(false)
  const anims = useRef<AnimationPlaybackControls[]>([])

  const w = useMotionValue(EXPANDED.w)
  const h = useMotionValue(EXPANDED.h)
  const r = useMotionValue(EXPANDED.r)
  const scale = useMotionValue(1)

  const { scrollY, scrollYProgress } = useScroll()
  const ringOffset = useTransform(
    useSpring(scrollYProgress, { stiffness: 320, damping: 42, restDelta: 0.0001 }),
    (p) => 100.53 * (1 - p),
  )

  /* section marks for the spy: position-based, so it always reverts to Overview */
  const marks = useRef({ routes: 1, directory: 2 })
  const measure = useCallback(() => {
    const top = window.scrollY
    const routes = document.getElementById('routes')
    const directory = document.getElementById('directory')
    marks.current = {
      routes: routes ? routes.getBoundingClientRect().top + top - 1 : Number.POSITIVE_INFINITY,
      directory: directory ? directory.getBoundingClientRect().top + top - 1 : Number.POSITIVE_INFINITY,
    }
  }, [])

  const spy = useCallback(() => {
    if (!onHome) return
    const probe = window.scrollY + window.innerHeight * 0.38
    let next = 'top'
    if (probe >= marks.current.directory) next = 'directory'
    else if (probe >= marks.current.routes) next = 'routes'
    setActive(next)
  }, [])

  const go = useCallback((id: string) => {
    setActive(id)
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const targetW = useCallback(() => {
    if (modeRef.current === 'compact') return hover.current ? PEEK_W : COMPACT.w
    const shell = navRef.current?.parentElement?.clientWidth ?? EXPANDED.w
    return Math.min(EXPANDED.w, shell)
  }, [])

  const stopAnims = () => {
    anims.current.forEach((a) => a.stop())
    anims.current = []
  }

  const morph = useCallback(
    (immediate = false) => {
      const compact = modeRef.current === 'compact'
      const tw = targetW()
      const th = compact ? COMPACT.h : EXPANDED.h
      const tr = compact ? COMPACT.r : EXPANDED.r
      if (reduce || immediate) {
        stopAnims()
        w.set(tw)
        h.set(th)
        r.set(tr)
        return
      }
      stopAnims()
      const cfg = compact ? SPRING_SHUT : SPRING_OPEN
      anims.current = [
        animate(w, tw, { ...cfg, velocity: w.getVelocity() }),
        animate(h, th, cfg),
        animate(r, tr, cfg),
      ]
    },
    [reduce, r, h, w, targetW],
  )

  const pop = useCallback(() => {
    if (reduce) return
    scale.set(0.962)
    animate(scale, 1, { type: 'spring', stiffness: 520, damping: 19, mass: 0.7 })
  }, [reduce, scale])

  /* scroll direction → mode, with hysteresis */
  useEffect(() => {
    const unsub = scrollY.on('change', (y) => {
      const dy = y - lastY.current
      lastY.current = y
      let next = modeRef.current
      if (y < 90) next = 'expanded'
      else if (dy > 4) next = 'compact'
      else if (dy < -10) next = 'expanded'
      if (next !== modeRef.current) {
        modeRef.current = next
        setMode(next)
        morph()
        if (next === 'expanded') pop()
      }
      spy()
    })
    return unsub
  }, [scrollY, morph, pop, spy, onHome])

  /* measure marks on mount, resize, and after fonts settle */
  useEffect(() => {
    measure()
    const t = setTimeout(measure, 600)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [measure])
  useEffect(() => {
    w.set(targetW())
    const shell = navRef.current?.parentElement
    if (!shell) return
    const ro = new ResizeObserver(() => {
      if (modeRef.current === 'expanded') w.set(targetW())
    })
    ro.observe(shell)
    return () => ro.disconnect()
  }, [targetW, w])

  /* pop on load */
  useEffect(() => {
    const t = setTimeout(pop, 120)
    return () => clearTimeout(t)
  }, [pop])

  /* mobile menu: close on navigation, and on Escape */
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  /* scrollspy */
  useEffect(() => {
    const els = SECTIONS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-35% 0px -55% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <>
    <motion.nav
      ref={navRef}
      className={`floating-nav ${mode === 'compact' ? 'is-compact' : ''}`}
      style={{ width: w, height: h, borderRadius: r, scale }}
      onMouseEnter={() => {
        if (modeRef.current !== 'compact') return
        hover.current = true
        animate(w, PEEK_W, SPRING_PEEK)
      }}
      onMouseLeave={() => {
        if (modeRef.current !== 'compact') return
        hover.current = false
        animate(w, COMPACT.w, SPRING_PEEK)
      }}
      aria-label="Main navigation"
    >
      <a
        className="isl-orb"
        href="#top"
        aria-label="Back to top"
        onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
      >
        <svg className="brand-ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="brand-ring-track" cx="18" cy="18" r="16" />
          <motion.circle className="brand-ring-prog" cx="18" cy="18" r="16" style={{ strokeDashoffset: ringOffset }} />
        </svg>
        <i>42</i>
      </a>
      <div className="isl-mid">
        <b className="brand-text">curriculum map</b>
        <div className="nav-links">
          <a
            href={onHome ? '#top' : '/'}
            className={activeId === 'top' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onHome ? go('top') : (window.location.href = '/') }}
          >
            Overview
          </a>
          <a
            href={onHome ? '#routes' : '/#routes'}
            className={activeId === 'routes' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onHome ? go('routes') : (window.location.href = '/#routes') }}
          >
            Paths
          </a>
          <Link href="/projects" className={activeId === 'directory' ? 'active' : ''} onClick={() => setActive('directory')}>
            Projects
          </Link>
          <Link href="/rncp" className={activeId === 'rncp' ? 'active' : ''} onClick={() => setActive('rncp')}>
            RNCP
          </Link>
          <Link href="/piscine" className={activeId === 'piscine' ? 'active' : ''} onClick={() => setActive('piscine')}>
            Piscine
          </Link>
        </div>
        <AuthWidget />
      </div>
      <div className="isl-actions">
        <button
          type="button"
          className="isl-menu-btn"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          {mobileNavOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
        <ThemeToggle />
      </div>
    </motion.nav>

    <AnimatePresence>
      {mobileNavOpen && (
        <>
          <motion.div
            className="isl-mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileNavOpen(false)}
          />
          <motion.div
            className="isl-mobile-menu"
            role="menu"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          >
            <a
              href={onHome ? '#top' : '/'}
              className={activeId === 'top' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setMobileNavOpen(false); onHome ? go('top') : (window.location.href = '/') }}
            >
              Overview
            </a>
            <a
              href={onHome ? '#routes' : '/#routes'}
              className={activeId === 'routes' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setMobileNavOpen(false); onHome ? go('routes') : (window.location.href = '/#routes') }}
            >
              Paths
            </a>
            <Link href="/projects" className={activeId === 'directory' ? 'active' : ''} onClick={() => { setActive('directory'); setMobileNavOpen(false) }}>
              Projects
            </Link>
            <Link href="/rncp" className={activeId === 'rncp' ? 'active' : ''} onClick={() => { setActive('rncp'); setMobileNavOpen(false) }}>
              RNCP
            </Link>
            <Link href="/piscine" className={activeId === 'piscine' ? 'active' : ''} onClick={() => { setActive('piscine'); setMobileNavOpen(false) }}>
              Piscine
            </Link>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  )
}
