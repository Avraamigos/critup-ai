import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, ORANGE } from './constants'

export function MascotComp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entry spring
  const entry = spring({ frame, fps, config: { damping: 14, stiffness: 80 } })

  // Float up/down — 4 s cycle
  const floatY = Math.sin((frame / fps) * (Math.PI * 2) / 4) * 14

  // Glow pulse — 3 s cycle
  const glow = 0.5 + 0.5 * Math.sin((frame / fps) * (Math.PI * 2) / 3)

  // Blink — every 5 s, lasts 4 frames
  const blinkCycle = Math.floor(frame % (fps * 5))
  const blink = blinkCycle >= fps * 4.7 ? 0.05 : 1

  // Eyes glance — 6 s cycle
  const glanceCycle = (frame / fps) % 6
  const eyeX =
    glanceCycle < 0.2 ? 0
    : glanceCycle < 0.4 ? interpolate(glanceCycle, [0.2, 0.4], [0, -1]) * 14
    : glanceCycle < 1.2 ? -14
    : glanceCycle < 1.4 ? interpolate(glanceCycle, [1.2, 1.4], [-1, 0]) * 14
    : glanceCycle < 3.2 ? 0
    : glanceCycle < 3.4 ? interpolate(glanceCycle, [3.2, 3.4], [0, 1]) * 14
    : glanceCycle < 4.2 ? 14
    : glanceCycle < 4.4 ? interpolate(glanceCycle, [4.2, 4.4], [1, 0]) * 14
    : 0

  // Text fade-in
  const textOpacity = interpolate(frame, [fps * 0.8, fps * 1.4], [0, 1], { extrapolateRight: 'clamp' })
  const textY = interpolate(frame, [fps * 0.8, fps * 1.4], [20, 0], { extrapolateRight: 'clamp' })

  const S = 280
  const eyeW = 28, eyeH = 46, eyeGap = 32
  const glowBlur = 16 + glow * 24
  const glowOpacity = 0.4 + glow * 0.45

  return (
    <AbsoluteFill style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      {/* Ripple rings */}
      {[0, 1, 2].map(i => {
        const ringProgress = ((frame / fps - i * 0.8) % 2.8) / 2.8
        const ringScale = 1 + ringProgress * 0.7
        const ringOpacity = (1 - ringProgress) * 0.25
        return (
          <div key={i} style={{
            position: 'absolute',
            width: S + 20, height: S + 20,
            borderRadius: '50%',
            border: `1.5px solid rgba(249,115,22,${ringOpacity})`,
            transform: `scale(${entry * ringScale}) translateY(${floatY}px)`,
          }} />
        )
      })}

      {/* Glow halo */}
      <div style={{
        position: 'absolute',
        width: S, height: S,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
        filter: `blur(${glowBlur}px)`,
        opacity: glowOpacity,
        transform: `scale(${entry}) translateY(${floatY}px)`,
      }} />

      {/* Orb body */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: S, height: S, borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
        boxShadow: `0 ${24 + glow * 8}px ${50 + glow * 30}px rgba(249,115,22,${0.3 + glow * 0.2})`,
        transform: `scale(${entry}) translateY(${floatY}px)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Specular */}
        <div style={{
          position: 'absolute', top: '18%', left: '18%',
          width: '30%', height: '20%',
          background: 'rgba(255,255,255,0.22)', borderRadius: '50%',
          transform: 'rotate(-30deg)',
        }} />
        {/* Eyes */}
        <div style={{ display: 'flex', gap: eyeGap, transform: `translateX(${eyeX}px)` }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: eyeW, height: eyeH,
              borderRadius: 999, background: '#fff',
              boxShadow: '0 0 12px rgba(255,255,255,0.9)',
              transform: `scaleY(${blink})`,
              transformOrigin: 'center',
            }} />
          ))}
        </div>
      </div>

      {/* Name */}
      <div style={{
        marginTop: 48,
        opacity: textOpacity,
        transform: `translateY(${textY}px)`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.04em', color: '#0f172a', lineHeight: 1 }}>
          Crit
        </div>
        <div style={{ fontSize: 22, color: '#64748b', fontWeight: 500, marginTop: 12, letterSpacing: '-0.01em' }}>
          Your AI architecture jury — always ready
        </div>
      </div>
    </AbsoluteFill>
  )
}
