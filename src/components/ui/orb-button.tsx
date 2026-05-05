import { useEffect, useRef } from 'react'

interface Props {
  onClick: () => void
  size?: number
  active?: boolean
}

export function OrbButton({ onClick, size = 48, active = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const cx = size / 2, cy = size / 2, r = size * 0.37
    let t = 0

    const trails = [
      { tilt:  0.10, azim: 0.0,              spd: 0.018, ph: 0.0,              arc: 0.50, w: size * 0.026, dir:  1 },
      { tilt: -0.38, azim: Math.PI * 0.3,    spd: 0.014, ph: Math.PI * 0.55,   arc: 0.44, w: size * 0.019, dir: -1 },
      { tilt:  1.20, azim: Math.PI * 0.6,    spd: 0.022, ph: Math.PI * 1.20,   arc: 0.38, w: size * 0.015, dir:  1 },
      { tilt: -1.05, azim: Math.PI * 0.9,    spd: 0.012, ph: Math.PI * 1.75,   arc: 0.48, w: size * 0.021, dir: -1 },
      { tilt:  0.88, azim: Math.PI * 1.2,    spd: 0.026, ph: Math.PI * 0.30,   arc: 0.32, w: size * 0.013, dir:  1 },
      { tilt: -0.65, azim: Math.PI * 1.5,    spd: 0.016, ph: Math.PI * 0.90,   arc: 0.40, w: size * 0.017, dir: -1 },
      { tilt:  1.50, azim: Math.PI * 0.4,    spd: 0.020, ph: Math.PI * 1.50,   arc: 0.35, w: size * 0.014, dir:  1 },
      { tilt: -1.40, azim: Math.PI * 1.8,    spd: 0.024, ph: Math.PI * 0.10,   arc: 0.28, w: size * 0.011, dir: -1 },
      { tilt:  0.55, azim: Math.PI * 0.7,    spd: 0.019, ph: Math.PI * 0.80,   arc: 0.42, w: size * 0.016, dir:  1 },
      { tilt: -0.25, azim: Math.PI * 1.1,    spd: 0.015, ph: Math.PI * 1.30,   arc: 0.38, w: size * 0.013, dir: -1 },
    ]

    function orbPt(a: number, tilt: number, azim: number, rr: number) {
      const x = Math.cos(a) * rr
      const y = Math.sin(a) * rr * 0.36
      const ct = Math.cos(tilt), st = Math.sin(tilt)
      const ca = Math.cos(azim),  sa = Math.sin(azim)
      const rx = x * ct - y * st
      const ry = x * st + y * ct
      const fx = rx * ca - ry * sa * 0.4
      const fy = rx * sa * 0.6 + ry * ca
      return { x: cx + fx, y: cy + fy, d: Math.sin(a) * Math.cos(azim * 0.5) }
    }

    const DOT_COUNT = size > 60 ? 180 : 80
    const golden = Math.PI * (3 - Math.sqrt(5))
    const dots: {
      bx: number; by: number; bz: number
      jitter: number; floatPhase: number; floatSpeed: number; dotSize: number
    }[] = []

    for (let i = 0; i < DOT_COUNT; i++) {
      const yy  = 1 - (i / (DOT_COUNT - 1)) * 2
      const rad = Math.sqrt(1 - yy * yy)
      const theta = golden * i
      const baseX = Math.cos(theta) * rad
      const baseZ = Math.sin(theta) * rad
      const jitter     = 0.85 + Math.random() * 0.3
      const floatPhase = Math.random() * Math.PI * 2
      const floatSpeed = 0.008 + Math.random() * 0.012
      const dotSize    = (size > 60 ? 0.8 : 0.5) + Math.random() * (size > 60 ? 0.9 : 0.5)
      dots.push({ bx: baseX, by: yy, bz: baseZ, jitter, floatPhase, floatSpeed, dotSize })
    }

    function frame() {
      ctx.clearRect(0, 0, size, size)

      // Ambient glow — slightly brighter when active
      const glowAlpha = active ? 0.16 : 0.10
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.5)
      bg.addColorStop(0,   `rgba(249,115,22,${glowAlpha})`)
      bg.addColorStop(0.5, `rgba(234,88,12,${glowAlpha * 0.4})`)
      bg.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = bg
      ctx.fill()

      const globalRot = t * 0.004

      for (const d of dots) {
        const fv   = Math.sin(t * d.floatSpeed + d.floatPhase) * 0.08
        const dist = (d.jitter + fv) * r
        const cosR = Math.cos(globalRot)
        const sinR = Math.sin(globalRot)
        const rx = d.bx * cosR - d.bz * sinR
        const rz = d.bx * sinR + d.bz * cosR
        const px = cx + rx * dist
        const py = cy + d.by * dist * 0.65 + rz * dist * 0.35
        const depth = rx * 0.5 + rz * 0.5
        const dep = 0.0 + 1.0 * ((depth + 1) / 2)
        const backside = depth < -0.05
        const alpha = backside ? dep * 0.08 : dep * 0.50
        if (alpha < 0.02) continue

        ctx.beginPath()
        ctx.arc(px, py, Math.max(0.3, d.dotSize * 0.4 * dep), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,${Math.floor(110 + 80 * dep)},${Math.floor(10 + 20 * dep)},${alpha})`
        ctx.fill()

        if (!backside && dep > 0.75) {
          const gr = ctx.createRadialGradient(px, py, 0, px, py, d.dotSize * 1.6)
          gr.addColorStop(0, `rgba(255,180,60,${dep * 0.20})`)
          gr.addColorStop(1, 'rgba(249,115,22,0)')
          ctx.beginPath()
          ctx.arc(px, py, d.dotSize * 1.6, 0, Math.PI * 2)
          ctx.fillStyle = gr
          ctx.fill()
        }
      }

      for (const s of trails) {
        const head = t * s.spd * s.dir + s.ph
        const tail = Math.PI * 2 * s.arc
        const N = 80
        for (let i = 0; i < N - 1; i++) {
          const f0 = i / (N - 1), f1 = (i + 1) / (N - 1)
          const a0 = head - s.dir * tail * (1 - f0)
          const a1 = head - s.dir * tail * (1 - f1)
          const p0 = orbPt(a0, s.tilt, s.azim, r)
          const p1 = orbPt(a1, s.tilt, s.azim, r)
          const dep = 0.2 + 0.8 * ((p0.d + 1) / 2)
          const al  = Math.pow(f0, 1.2) * dep * 0.96

          ctx.beginPath()
          ctx.moveTo(p0.x, p0.y)
          ctx.lineTo(p1.x, p1.y)
          ctx.strokeStyle = `rgba(255,${Math.floor(65 + 65 * f0)},${Math.floor(5 + 10 * f0)},${al})`
          ctx.lineWidth = s.w * (0.2 + 0.8 * f0) * dep
          ctx.lineCap = 'round'
          ctx.stroke()

          if (f0 > 0.80) {
            const ga  = ((f0 - 0.80) / 0.20) * 0.70 * dep
            const gr2 = s.w * 2.8 * dep
            const gw  = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, gr2)
            gw.addColorStop(0, `rgba(255,175,45,${ga})`)
            gw.addColorStop(1, 'rgba(249,115,22,0)')
            ctx.beginPath()
            ctx.arc(p1.x, p1.y, gr2, 0, Math.PI * 2)
            ctx.fillStyle = gw
            ctx.fill()
          }
        }
      }

      // Core inner glow
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.45)
      core.addColorStop(0, 'rgba(255,200,80,0.12)')
      core.addColorStop(1, 'rgba(249,115,22,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2)
      ctx.fillStyle = core
      ctx.fill()

      t++
      rafRef.current = requestAnimationFrame(frame)
    }

    frame()

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [size, active])

  return (
    <button
      onClick={onClick}
      aria-label="AI Assistant"
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s',
        borderRadius: '50%',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block' }}
      />
    </button>
  )
}
