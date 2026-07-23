import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'

let scrollTriggerRegistered = false

export function SiteMotionProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const supportsEnhancedScroll = window.matchMedia('(pointer: fine) and (min-width: 1024px)')

    if (prefersReducedMotion.matches || !supportsEnhancedScroll.matches) {
      document.documentElement.classList.add('motion-ready')
      return () => {
        document.documentElement.classList.remove('motion-ready')
      }
    }

    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger)
      scrollTriggerRegistered = true
    }

    const lenis = new Lenis({
      duration: 0.9,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1,
      syncTouch: false,
    })

    document.documentElement.classList.add('motion-ready')

    const handleLenisScroll = () => {
      ScrollTrigger.update()
    }

    lenis.on('scroll', handleLenisScroll)

    let frameId = 0

    const raf = (time: number) => {
      lenis.raf(time)
      frameId = window.requestAnimationFrame(raf)
    }

    frameId = window.requestAnimationFrame(raf)

    return () => {
      window.cancelAnimationFrame(frameId)
      lenis.destroy()
      document.documentElement.classList.remove('motion-ready')
    }
  }, [])

  return children
}
