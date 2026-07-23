import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router-dom'

/**
 * Slim progress bar at the very top of the viewport — appears whenever
 * React Router is loading a new route (lazy chunks, data loaders, etc.).
 */
export function NavProgress() {
  const prefersReducedMotion = useReducedMotion()
  const { state } = useNavigation()
  const isLoading = state !== 'idle'

  // Give it a slight delay so it only shows for slower transitions
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!isLoading) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [isLoading])

  if (prefersReducedMotion || !visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[300] h-[3px]">
      <motion.div
        className="h-full origin-left"
        style={{
          background: 'linear-gradient(90deg, #2f6fff, #3f8cff, #60a5fa)',
          boxShadow: '0 0 12px rgba(63,140,255,0.7)',
        }}
        initial={{ scaleX: 0.08 }}
        animate={{ scaleX: 0.72 }}
        transition={{ duration: 8, ease: 'easeOut' }}
        key="loading"
      />
    </div>
  )
}
