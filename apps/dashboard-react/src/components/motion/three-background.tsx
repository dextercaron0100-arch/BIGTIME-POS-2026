import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'framer-motion'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

/* ─── Floating particle field ─────────────────────────────────────────── */

function ParticleField({ count = 140 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)

  const [positions] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 32
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12
    }
    return [pos]
  }, [count])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.y = t * 0.016
    ref.current.rotation.x = Math.sin(t * 0.009) * 0.05
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        sizeAttenuation
        color="#3f8cff"
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </points>
  )
}

/* ─── Glowing torus rings ─────────────────────────────────────────────── */

function GlowTorus({
  position,
  radius,
  tube,
  speed,
  color,
  opacity,
}: {
  position: [number, number, number]
  radius: number
  tube: number
  speed: number
  color: string
  opacity: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current || !glowRef.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.x = t * speed
    ref.current.rotation.z = t * speed * 0.6
    ref.current.position.y = position[1] + Math.sin(t * 0.28) * 0.2
    glowRef.current.rotation.x = ref.current.rotation.x
    glowRef.current.rotation.z = ref.current.rotation.z
    glowRef.current.position.y = ref.current.position.y
  })

  return (
    <group>
      {/* Core ring */}
      <mesh ref={ref} position={position}>
        <torusGeometry args={[radius, tube, 16, 120]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {/* Soft glow halo — slightly larger, more transparent */}
      <mesh ref={glowRef} position={position}>
        <torusGeometry args={[radius, tube * 5, 16, 120]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.09} />
      </mesh>
    </group>
  )
}

/* ─── Perspective grid plane ──────────────────────────────────────────── */

function GridPlane() {
  const ref = useRef<THREE.LineSegments>(null)

  const geometry = useMemo(() => {
    const size = 28
    const divisions = 18
    const step = size / divisions
    const halfSize = size / 2

    const vertices: number[] = []

    for (let i = 0; i <= divisions; i++) {
      const x = -halfSize + i * step
      vertices.push(x, 0, -halfSize, x, 0, halfSize)
    }
    for (let i = 0; i <= divisions; i++) {
      const z = -halfSize + i * step
      vertices.push(-halfSize, 0, z, halfSize, 0, z)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    return geo
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.z = ((clock.getElapsedTime() * 0.28) % (28 / 18)) - 14
  })

  return (
    <lineSegments ref={ref} geometry={geometry} position={[0, -4, 0]} rotation={[0, 0, 0]}>
      <lineBasicMaterial color="#2f6fff" transparent opacity={0.07} />
    </lineSegments>
  )
}

/* ─── Public component ────────────────────────────────────────────────── */

export function ThreeBackground() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.8 }}
    >
      <Canvas
        camera={{ position: [0, 1.5, 9], fov: 62 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
        frameloop={prefersReducedMotion ? 'never' : 'always'}
      >
        <ParticleField count={140} />
        <GlowTorus
          position={[3.8, -0.8, -4]}
          radius={2.6}
          tube={0.014}
          speed={0.07}
          color="#2f6fff"
          opacity={0.18}
        />
        <GlowTorus
          position={[-4.8, 1.8, -3]}
          radius={1.6}
          tube={0.011}
          speed={0.095}
          color="#3f8cff"
          opacity={0.14}
        />
        <GlowTorus
          position={[0.5, 3.2, -7]}
          radius={4.0}
          tube={0.009}
          speed={0.04}
          color="#60a5fa"
          opacity={0.08}
        />
        <GridPlane />
      </Canvas>
    </div>
  )
}
