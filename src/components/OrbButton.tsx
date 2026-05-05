import { useEffect, useRef } from 'react'

interface Props {
  onClick: () => void
  active?: boolean
  processing?: boolean
  size?: number
}

/**
 * Animated glowing orb — a dark sphere with three orange light-streak
 * orbits continuously wrapping around it (canvas-based, 60fps).
 *
 * The key trick: streaks are drawn BEFORE the dark sphere, so the sphere
 * naturally clips the "behind" portion → free 3D orbital illusion.
 */
export function OrbButton({ onClick, active = false, processing = false, size = 34 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const R  = size * 0.37          // sphere radius

    // Three orbital planes, each at a different tilt and speed
    const orbits = [
      { tilt: 0,     phase: 0,    rx: R * 1.22, ry: R * 0.30, speed: 1.00, bright: 1.0  },
      { tilt: 0.62,  phase: 2.09, rx: R * 1.16, ry: R * 0.26, speed: 0.72, bright: 0.85 },
      { tilt: -0.42, phase: 4.19, rx: R * 1.12, ry: R * 0.38, speed: 1.38, bright: 0.72 },
    ]

    const TAIL_ARC = Math.PI * 0.7   // radians — how long each comet tail is
    const STEPS    = 22              // segments per tail

    const draw = (ms: number) => {
      const t     = ms * 0.001 * (processing ? 2.2 : active ? 1.25 : 0.9)
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.4)

      ctx.clearRect(0, 0, size, size)

      // ── 1. Ambient outer glow (pulses slowly) ──
      const glowR = R * (1.75 + 0.28 * pulse)
      const aGlow = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, glowR)
      aGlow.addColorStop(0, `rgba(249,115,22,${0.14 + 0.07 * pulse})`)
      aGlow.addColorStop(1, 'rgba(249,115,22,0)')
      ctx.fillStyle = aGlow
      ctx.beginPath()
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
      ctx.fill()

      // ── 2. Orbital streaks (drawn BEFORE sphere so sphere occludes them) ──
      orbits.forEach(orb => {
        const angle = t * orb.speed + orb.phase

        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(orb.tilt)

        // Comet tail — gradient from bright (leading) to transparent (trailing)
        for (let i = 0; i < STEPS; i++) {
          const a0 = angle - (i       / STEPS) * TAIL_ARC
          const a1 = angle - ((i + 1) / STEPS) * TAIL_ARC
          const progress = 1 - i / STEPS
          const alpha    = orb.bright * progress * progress * 0.92
          const width    = 1.9 * (0.3 + 0.7 * progress)

          ctx.beginPath()
          ctx.moveTo(Math.cos(a0) * orb.rx, Math.sin(a0) * orb.ry)
          ctx.lineTo(Math.cos(a1) * orb.rx, Math.sin(a1) * orb.ry)
          ctx.strokeStyle = `rgba(249,115,22,${alpha})`
          ctx.lineWidth   = width
          ctx.lineCap     = 'round'
          ctx.stroke()
        }

        // Bright comet head (radial glow around leading point)
        const hx = Math.cos(angle) * orb.rx
        const hy = Math.sin(angle) * orb.ry
        for (let rad = 3.5; rad >= 0.5; rad -= 0.75) {
          const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, rad + 0.5)
          hg.addColorStop(0, `rgba(255,200,110,${orb.bright * (0.55 - rad * 0.1)})`)
          hg.addColorStop(1, 'rgba(249,115,22,0)')
          ctx.fillStyle = hg
          ctx.beginPath()
          ctx.arc(hx, hy, rad + 0.5, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      })

      // ── 3. Dark sphere — painted on top → occludes "behind" streak segments ──
      const sphere = ctx.createRadialGradient(
        cx - R * 0.18, cy - R * 0.22, 0,
        cx, cy, R
      )
      sphere.addColorStop(0,   'rgba(50, 20, 5, 0.97)')
      sphere.addColorStop(0.6, 'rgba(14, 5, 1, 0.99)')
      sphere.addColorStop(1,   'rgba(0, 0, 0, 1.0)')
      ctx.fillStyle = sphere
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      // ── 4. Sphere rim light (orange corona on the edges) ──
      const rim = ctx.createRadialGradient(cx, cy, R * 0.68, cx, cy, R * 1.04)
      rim.addColorStop(0,   'rgba(234,88,12,0)')
      rim.addColorStop(0.7, `rgba(234,88,12,${0.20 + 0.10 * pulse})`)
      rim.addColorStop(1,   'rgba(234,88,12,0)')
      ctx.fillStyle = rim
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      // ── 5. Specular highlight ──
      const spec = ctx.createRadialGradient(
        cx - R * 0.28, cy - R * 0.33, 0,
        cx - R * 0.28, cy - R * 0.33, R * 0.42
      )
      spec.addColorStop(0, 'rgba(255,185,100,0.17)')
      spec.addColorStop(1, 'rgba(255,100,20,0)')
      ctx.fillStyle = spec
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size, active, processing])

  return (
    <button
      onClick={onClick}
      aria-label="Open AI Assistant"
      title="AI Assistant"
      style={{
        position: 'relative',
        width: size, height: size,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        flexShrink: 0,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block', borderRadius: '50%' }}
      />
    </button>
  )
}
