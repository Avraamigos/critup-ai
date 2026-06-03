import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, ORANGE } from './constants'

export function ScoreRevealComp() {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  // Project name types in
  const nameProgress = interpolate(frame, [fps * 0.3, fps * 1.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const nameOpacity  = interpolate(frame, [fps * 0.3, fps * 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Score ring draws + counts up
  const scoreDelay = fps * 1.4
  const scoreProgress = interpolate(frame - scoreDelay, [0, fps * 1.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const eased = 1 - Math.pow(1 - scoreProgress, 4)
  const scoreVal = 8.5 * eased
  const scoreOpacity = interpolate(frame - scoreDelay, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const scoreEntry = spring({ frame: frame - scoreDelay, fps, config: { damping: 14 } })

  // "Overall Score" label
  const labelOpacity = interpolate(frame - scoreDelay - fps * 0.3, [0, fps * 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Sub-scores cascade in
  const subScores = [
    { label: 'Concept',      val: 8.5, color: ORANGE,                 delay: fps * 3.8 },
    { label: 'Spatial',      val: 7.2, color: 'rgba(239,68,68,1)',     delay: fps * 4.2 },
    { label: 'Presentation', val: 9.1, color: 'rgba(34,197,94,1)',     delay: fps * 4.6 },
  ]

  // Ring dimensions
  const R = 130
  const CIRC = 2 * Math.PI * R
  const dashOffset = CIRC - scoreProgress * (8.5 / 10) * CIRC

  // Glow pulse on ring
  const glowPulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2 / 2)

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(160deg, #0f1117 0%, #1a0f05 60%, #0f1117 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      {/* Ambient orange glow behind ring */}
      {scoreProgress > 0 && (
        <div style={{
          position: 'absolute',
          width: 420, height: 420, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(249,115,22,${0.08 + glowPulse * 0.07}) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Project name */}
      <div style={{
        fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '.15em',
        textTransform: 'uppercase', marginBottom: 52,
        opacity: nameOpacity,
        transform: `translateY(${(1 - nameProgress) * -16}px)`,
      }}>
        Riverside Cultural Pavilion
      </div>

      {/* Score ring */}
      <div style={{ position: 'relative', opacity: scoreOpacity, transform: `scale(${scoreEntry})` }}>
        <svg width={R * 2 + 40} height={R * 2 + 40} viewBox={`0 0 ${R * 2 + 40} ${R * 2 + 40}`}>
          {/* Track */}
          <circle
            cx={R + 20} cy={R + 20} r={R}
            fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={12}
          />
          {/* Glow copy */}
          <circle
            cx={R + 20} cy={R + 20} r={R}
            fill="none" stroke={ORANGE} strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${R + 20} ${R + 20})`}
            style={{ filter: `drop-shadow(0 0 ${8 + glowPulse * 10}px rgba(249,115,22,0.8))` }}
          />
        </svg>

        {/* Score value */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 88, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.04em' }}>
            {scoreVal.toFixed(1)}
          </div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginTop: 4 }}>/10</div>
        </div>
      </div>

      {/* "Overall Score" label */}
      <div style={{
        fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
        letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 32, marginBottom: 52,
        opacity: labelOpacity,
      }}>
        Overall Score
      </div>

      {/* Sub-score pills */}
      <div style={{ display: 'flex', gap: 16 }}>
        {subScores.map(({ label, val, color, delay }) => {
          const pillEntry = spring({ frame: frame - delay, fps, config: { damping: 14 } })
          const pillOpacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          return (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.06)', borderRadius: 100,
              padding: '12px 24px', border: `1px solid rgba(255,255,255,0.1)`,
              opacity: pillOpacity,
              transform: `scale(${pillEntry}) translateY(${(1 - pillEntry) * 12}px)`,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 18, fontWeight: 900, color }}>{val}</span>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
