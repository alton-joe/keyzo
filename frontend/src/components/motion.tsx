import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import Lenis from 'lenis'

/** Buttery smooth wheel scrolling for the marketing pages (disabled for reduced-motion users). */
export function SmoothScroll() {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) return
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
    let id = requestAnimationFrame(function raf(t) { lenis.raf(t); id = requestAnimationFrame(raf) })
    return () => { cancelAnimationFrame(id); lenis.destroy() }
  }, [reduce])
  return null
}

/** Thin gradient bar showing page scroll progress. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.2 })
  return <motion.div style={{ scaleX }} className="gradient-brand fixed inset-x-0 top-0 z-[60] h-[3px] origin-left" />
}

/** Fade + rise into view when scrolled to. */
export function Reveal({ children, delay = 0, y = 28, className, as = 'div', once = true }:
  { children: ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'section' | 'li'; once?: boolean }) {
  const reduce = useReducedMotion()
  const M = motion[as]
  return (
    <M className={className} initial={reduce ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </M>
  )
}

/** Stagger children as they enter. */
export function Stagger({ children, className, gap = 0.08 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}>
      {children}
    </motion.div>
  )
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={{ hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}>{children}</motion.div>
}

/** Number that counts up when it scrolls into view. */
export function CountUp({ to, decimals = 0, prefix = '', suffix = '', duration = 1.6 }: { to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const v = useMotionValue(0)
  const [text, setText] = useState(`${prefix}${(0).toFixed(decimals)}${suffix}`)
  useEffect(() => v.on('change', (x) => setText(`${prefix}${x.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`)), [v, prefix, suffix, decimals])
  useEffect(() => { if (inView) { const c = animate(v, to, { duration, ease: 'easeOut' }); return () => c.stop() } }, [inView, to, duration, v])
  return <span ref={ref}>{text}</span>
}

/** Element that drifts at a different speed than the page (parallax). */
export function Parallax({ children, speed = 60, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed])
  return <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>{children}</motion.div>
}
