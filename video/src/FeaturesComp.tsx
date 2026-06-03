import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, ORANGE } from './constants'

const FEATURES = [
  { icon: '📄', title: 'Upload your drawings',       sub: 'PDF up to 10 pages — any architecture project' },
  { icon: '🎯', title: 'Get scored across 3 axes',   sub: 'Concept strength · Spatial logic · Presentation clarity' },
  { icon: '⚖️', title: 'Simulate your jury',         sub: 'AI asks the hard questions before the real panel does' },
  { icon: '💬', title: 'Ask anything about your work', sub: 'Chat with Crit for targeted advice, anytime' },
  { icon: '📊', title: 'Export your full report',    sub: 'PDF critique with scores — shareable with your tutor' },
]

// Animated checkmark drawn with SVG stroke
function Checkmark({ progress }: { progress: number }) {
  const CIRC = 22 * Math.PI // circle circumference ≈ 69
  const checkLen = 18        // path length of the tick
  const circFill = Math.min(progress * 2, 1)       // circle draws in first half
  const tickFill = Math.max((progress - 0.5) * 2, 0) // tick draws in second half

  return (
    <svg width={36} height={36} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      {/* Circle */}
      <circle cx="18" cy="18" r="11" fill={`rgba(249,115,22,${circFill * 0.12})`}
        stroke={ORANGE} strokeWidth="2.5"
        strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - circFill)}
        transform="rotate(-90 18 18)"
      />
      {/* Tick */}
      <polyline
        points="11.5,18 16,23 24.5,13"
        fill="none" stroke={ORANGE} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={checkLen} strokeDashoffset={checkLen * (1 - tickFill)}
      />
    </svg>
  )
}

function FeatureRow({ icon, title, sub, delay }: { icon: string, title: string, sub: string, delay: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = interpolate(frame - delay, [0, fps * 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 90 } })
  const opacity = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const checkProgress = interpolate(frame - delay, [0, fps * 0.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20,
      opacity, transform: `translateX(${(1 - slideIn) * -40}px)`,
    }}>
      <Checkmark progress={checkProgress} />
      <div style={{ fontSize: 40, lineHeight: 1, width: 52, textAlign: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{title}</div>
        <div style={{ fontSize: 15, color: '#64748b', marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  )
}

export function FeaturesComp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headerEntry = spring({ frame, fps, config: { damping: 12 } })
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{
      background: '#ffffff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      {/* Subtle top glow */}
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 400,
        background: 'radial-gradient(ellipse, rgba(249,115,22,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: 680, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Header */}
        <div style={{
          marginBottom: 52, opacity: headerOpacity,
          transform: `translateY(${(1 - headerEntry) * -20}px)`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            What Critup does
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', lineHeight: 1.1 }}>
            Everything your jury<br />expects you to know.
          </div>
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.title} {...f} delay={fps * (0.4 + i * 0.45)} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}
