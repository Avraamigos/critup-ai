import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, ORANGE } from './constants'

const QUESTIONS = [
  "How does the industrial vocabulary serve the civic program rather than just reference it?",
  "Walk us through the section — what's the spatial experience from entry to gallery?",
  "Your material palette is minimal. How does it create warmth in such a large public space?",
]

export function JuryComp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Badge entry
  const badgeEntry = spring({ frame, fps, config: { damping: 12 } })
  const badgeOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })

  // Card entry
  const cardEntry = spring({ frame: frame - 10, fps, config: { damping: 14 } })
  const cardOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: 'clamp' })

  // Question rotation — every 4 seconds
  const qDuration = fps * 4
  const qIndex = Math.min(Math.floor(frame / qDuration), QUESTIONS.length - 1)
  const qFrame = frame % qDuration
  // Crossfade: fade out in last 15 frames, fade in first 15 frames
  const qOpacity =
    qFrame < 15 ? interpolate(qFrame, [0, 15], [0, 1])
    : qFrame > qDuration - 15 ? interpolate(qFrame, [qDuration - 15, qDuration], [1, 0])
    : 1

  // Mic pulse
  const micPulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2 * 0.8)

  // Timer — real seconds from start
  const totalSeconds = Math.floor(frame / fps)
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const secs = String(totalSeconds % 60).padStart(2, '0')

  // Controls entry
  const ctrlEntry = spring({ frame: frame - 20, fps, config: { damping: 12 } })
  const ctrlOpacity = interpolate(frame, [20, 38], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, fontFamily: FONT }}>
      {/* Live badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: `rgba(249,115,22,0.1)`, border: `1px solid rgba(249,115,22,0.25)`,
        borderRadius: 100, padding: '10px 24px',
        opacity: badgeOpacity, transform: `scale(${badgeEntry})`,
      }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: ORANGE, opacity: 0.5 + micPulse * 0.5 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: ORANGE, letterSpacing: '.08em' }}>JURY SIMULATION — LIVE</span>
      </div>

      {/* Question card */}
      <div style={{
        width: 780, background: '#fff', borderRadius: 28, padding: '56px 64px',
        boxShadow: '0 16px 64px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0',
        textAlign: 'center',
        opacity: cardOpacity, transform: `scale(${cardEntry})`,
      }}>
        <div style={{ fontSize: 48, marginBottom: 24 }}>⚖️</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 20 }}>
          Jury Question {qIndex + 1} of {QUESTIONS.length}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.5, letterSpacing: '-0.01em', opacity: qOpacity }}>
          "{QUESTIONS[qIndex]}"
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#f1f5f9', borderRadius: 99, marginTop: 36, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${100 - (qFrame / qDuration) * 100}%`,
            background: ORANGE, borderRadius: 99,
            transition: 'none',
          }} />
        </div>
      </div>

      {/* Controls row */}
      <div style={{
        display: 'flex', gap: 20, alignItems: 'center',
        opacity: ctrlOpacity, transform: `translateY(${(1 - ctrlEntry) * 16}px)`,
      }}>
        {/* Timer */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '14px 26px',
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {mins}:{secs}
          </span>
        </div>

        {/* Mic button */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: ORANGE,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 ${24 + micPulse * 24}px rgba(249,115,22,${0.35 + micPulse * 0.3})`,
        }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        {/* Next */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '14px 26px',
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
          fontSize: 17, fontWeight: 600, color: '#64748b',
        }}>
          Next →
        </div>
      </div>
    </AbsoluteFill>
  )
}
