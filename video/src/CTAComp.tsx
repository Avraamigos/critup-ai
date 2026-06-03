import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, ORANGE } from './constants'

export function CTAComp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Orb entry
  const orbEntry  = spring({ frame, fps, config: { damping: 12, stiffness: 70 } })
  const orbOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
  const orbFloat   = Math.sin((frame / fps) * Math.PI * 2 / 4) * 10
  const orbGlow    = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2 / 3)
  const orbBlink   = (Math.floor(frame % (fps * 5)) >= fps * 4.7) ? 0.06 : 1

  // Text elements
  const taglineEntry  = spring({ frame: frame - fps * 0.6, fps, config: { damping: 14 } })
  const taglineOpacity = interpolate(frame, [fps * 0.6, fps * 1.1], [0, 1], { extrapolateRight: 'clamp' })

  const domainEntry   = spring({ frame: frame - fps * 1.1, fps, config: { damping: 14 } })
  const domainOpacity = interpolate(frame, [fps * 1.1, fps * 1.6], [0, 1], { extrapolateRight: 'clamp' })

  const badgeEntry    = spring({ frame: frame - fps * 1.6, fps, config: { damping: 14 } })
  const badgeOpacity  = interpolate(frame, [fps * 1.6, fps * 2.0], [0, 1], { extrapolateRight: 'clamp' })

  const btnEntry      = spring({ frame: frame - fps * 2.1, fps, config: { damping: 12 } })
  const btnOpacity    = interpolate(frame, [fps * 2.1, fps * 2.5], [0, 1], { extrapolateRight: 'clamp' })
  const btnGlow       = 0.35 + orbGlow * 0.25

  // Ripple rings around orb
  const rings = [0, 1, 2].map(i => {
    const t = ((frame / fps - i * 1.2) % 3.6) / 3.6
    return { scale: 1 + t * 0.9, opacity: (1 - t) * 0.18 }
  })

  const ORB_SIZE = 120
  const EYE_W = 12, EYE_H = 20, EYE_GAP = 14

  return (
    <AbsoluteFill style={{
      background: '#ffffff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, gap: 0,
    }}>
      {/* Top ambient glow */}
      <div style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 500,
        background: 'radial-gradient(ellipse, rgba(249,115,22,0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Orb with rings */}
      <div style={{ position: 'relative', width: ORB_SIZE + 80, height: ORB_SIZE + 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}>
        {rings.map((r, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: ORB_SIZE, height: ORB_SIZE, borderRadius: '50%',
            border: '1.5px solid rgba(249,115,22,1)',
            transform: `scale(${orbEntry * r.scale}) translateY(${orbFloat}px)`,
            opacity: r.opacity,
          }} />
        ))}

        {/* Glow halo */}
        <div style={{
          position: 'absolute',
          width: ORB_SIZE, height: ORB_SIZE, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
          filter: `blur(${14 + orbGlow * 18}px)`,
          opacity: (0.4 + orbGlow * 0.4) * orbEntry,
          transform: `translateY(${orbFloat}px)`,
        }} />

        {/* Orb body */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: ORB_SIZE, height: ORB_SIZE, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
          boxShadow: `0 ${16 + orbGlow * 8}px ${36 + orbGlow * 20}px rgba(249,115,22,${0.3 + orbGlow * 0.2})`,
          transform: `scale(${orbEntry}) translateY(${orbFloat}px)`,
          opacity: orbOpacity,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'absolute', top: '18%', left: '18%', width: '30%', height: '22%', background: 'rgba(255,255,255,0.22)', borderRadius: '50%', transform: 'rotate(-30deg)' }} />
          <div style={{ display: 'flex', gap: EYE_GAP }}>
            {[0, 1].map(i => (
              <div key={i} style={{ width: EYE_W, height: EYE_H, borderRadius: 999, background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.9)', transform: `scaleY(${orbBlink})`, transformOrigin: 'center' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em', color: '#0f172a', lineHeight: 1.1,
        textAlign: 'center', marginBottom: 16,
        opacity: taglineOpacity, transform: `translateY(${(1 - taglineEntry) * 20}px)`,
      }}>
        Get your first critique<br />
        <span style={{ color: ORANGE }}>free.</span>
      </div>

      {/* Domain */}
      <div style={{
        fontSize: 28, fontWeight: 700, color: '#94a3b8', letterSpacing: '-0.02em', marginBottom: 36,
        opacity: domainOpacity, transform: `translateY(${(1 - domainEntry) * 14}px)`,
      }}>
        critup<span style={{ color: ORANGE }}>.ai</span>
      </div>

      {/* Badges row */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 44,
        opacity: badgeOpacity, transform: `scale(${badgeEntry})`,
      }}>
        {['No credit card', 'Free to start', 'Architecture students'].map(label => (
          <div key={label} style={{
            padding: '8px 18px', borderRadius: 100,
            background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
            fontSize: 14, fontWeight: 600, color: ORANGE,
          }}>{label}</div>
        ))}
      </div>

      {/* CTA button */}
      <div style={{
        padding: '18px 56px', borderRadius: 100,
        background: ORANGE,
        boxShadow: `0 0 ${28 + orbGlow * 20}px rgba(249,115,22,${btnGlow}), 0 8px 32px rgba(249,115,22,0.3)`,
        fontSize: 20, fontWeight: 700, color: '#fff',
        opacity: btnOpacity, transform: `scale(${btnEntry})`,
        letterSpacing: '-0.01em',
      }}>
        Start free — no card needed →
      </div>
    </AbsoluteFill>
  )
}
