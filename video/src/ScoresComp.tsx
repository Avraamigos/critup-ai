import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence } from 'remotion'
import { FONT, ORANGE } from './constants'

function ScoreCard({ score, label, color, delay }: { score: number, label: string, color: string, delay: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entry = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 80 } })
  const countProgress = interpolate(frame - delay, [0, fps * 1.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const eased = 1 - Math.pow(1 - countProgress, 4)
  const val = score * eased
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const r = 56
  const circ = 2 * Math.PI * r
  const dashOffset = circ - (val / 10) * circ

  return (
    <div style={{
      background: '#fff', borderRadius: 28, padding: '40px 36px', textAlign: 'center',
      boxShadow: '0 8px 48px rgba(0,0,0,0.09)', border: '1px solid #f1f5f9', width: 240,
      transform: `scale(${entry}) translateY(${(1 - entry) * 30}px)`,
      opacity,
    }}>
      <svg width={130} height={130} viewBox="0 0 130 130" style={{ display: 'block', margin: '0 auto 20px' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 65 65)"
        />
        <text x="65" y="58" textAnchor="middle" fontSize="26" fontWeight="900" fontFamily={FONT} fill="#0f172a">
          {val.toFixed(1)}
        </text>
        <text x="65" y="76" textAnchor="middle" fontSize="13" fontWeight="600" fontFamily={FONT} fill="#94a3b8">
          /10
        </text>
      </svg>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{label}</div>
    </div>
  )
}

export function ScoresComp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headerEntry = spring({ frame, fps, config: { damping: 14 } })
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  // Overall score
  const overallDelay = fps * 0.8
  const overallProgress = interpolate(frame - overallDelay, [0, fps * 1.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const overallEased = 1 - Math.pow(1 - overallProgress, 4)
  const overallVal = 8.5 * overallEased
  const badgeEntry = spring({ frame: frame - overallDelay, fps, config: { damping: 12 } })

  return (
    <AbsoluteFill style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ textAlign: 'center', opacity: headerOpacity, transform: `translateY(${(1 - headerEntry) * 24}px)` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          AI Critique Report
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a' }}>
          Riverside Cultural Pavilion
        </div>
        <div style={{ fontSize: 18, color: '#64748b', marginTop: 8 }}>
          Finalized Design · Full Analysis
        </div>
      </div>

      {/* Cards row */}
      <div style={{ display: 'flex', gap: 24 }}>
        <ScoreCard score={8.5} label="Concept"      color={ORANGE}                   delay={fps * 0.3} />
        <ScoreCard score={7.2} label="Spatial"      color="rgba(239,68,68,1)"        delay={fps * 0.5} />
        <ScoreCard score={9.1} label="Presentation" color="rgba(34,197,94,1)"        delay={fps * 0.7} />
      </div>

      {/* Overall badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 24,
        background: '#fff', borderRadius: 24, padding: '24px 48px',
        boxShadow: '0 8px 48px rgba(0,0,0,0.09)',
        border: `2px solid rgba(249,115,22,0.2)`,
        transform: `scale(${badgeEntry})`,
        opacity: interpolate(frame - overallDelay, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <div style={{ fontSize: 72, fontWeight: 900, color: ORANGE, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {overallVal.toFixed(1)}
          <span style={{ fontSize: 28, color: '#94a3b8', fontWeight: 600 }}>/10</span>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Overall Score</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Strong submission 🎯</div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
