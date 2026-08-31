'use client'

import { motion, useScroll, useSpring } from 'motion/react'

/* top progress bar driven by a real spring at native refresh rate */
export default function ScrollBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 350, damping: 45, mass: 0.6, restDelta: 0.0001 })

  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden />
}
