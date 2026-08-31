'use client'

import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react'
import { useRef } from 'react'

const SKILLS = ['C', 'C++', 'UNIX', 'Shell', 'Docker', 'Networking', 'OpenGL', 'Assembly', 'Threads', 'HTTP', 'TCP/IP', 'OOP', 'Git', 'Virtualization']
const BASE_SPEED = 3.2 // % of track per second

const wrap = (min: number, max: number, v: number) => {
  const range = max - min
  return ((((v - min) % range) + range) % range) + min
}

/* velocity-reactive marquee: drifts ambiently, reverses + accelerates with scroll momentum */
export default function SkillMarquee() {
  const reduce = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const inView = useInView(trackRef, { margin: '120px 0px' })

  const baseX = useMotionValue(0)
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  const smooth = useSpring(velocity, { stiffness: 400, damping: 50, mass: 0.5 })
  const factor = useTransform(smooth, [-2500, 2500], [-7, 7], { clamp: false })
  const direction = useRef(1)

  useAnimationFrame((_, delta) => {
    if (reduce || !inView) return
    const d = Math.min(delta, 64)
    let moveBy = direction.current * BASE_SPEED * (d / 1000)
    const vf = factor.get()
    if (vf < -0.2) direction.current = -1
    else if (vf > 0.2) direction.current = 1
    moveBy += direction.current * moveBy * Math.abs(vf)
    baseX.set(baseX.get() + moveBy)
  })

  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`)

  return (
    <div className="marquee" aria-hidden>
      <motion.div ref={trackRef} className="marquee-track" style={{ x }}>
        {[0, 1].map((g) => (
          <div className="marquee-group" key={g} aria-hidden={g === 1}>
            {SKILLS.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
