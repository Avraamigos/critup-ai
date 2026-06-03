import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, ORANGE } from './constants'

function BlurScore({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(0,0,0,0.06)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#ccc', filter: 'blur(4px)' }}>?.?</div>
    </div>
  )
}

function RealScore({ label, val, color }: { label: string, val: number, color: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '10px', textAlign: 'center', border: `1px solid ${color}33` }}>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>{val}</div>
    </div>
  )
}

export function BeforeAfterComp() {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  // Divider sweeps left → right
  const wipeStart = fps * 1.2
  const wipeEnd   = fps * 5.5
  const dividerX  = interpolate(frame, [wipeStart, wipeEnd], [0, width], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Labels
  const beforeOpacity = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: 'clamp' })
  const afterOpacity  = interpolate(frame, [fps * 1.0, fps * 1.6], [0, 1], { extrapolateRight: 'clamp' })

  // Card entries
  const cardEntry = spring({ frame, fps, config: { damping: 14 } })
  const cardOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  const CARD_W = 440

  return (
    <AbsoluteFill style={{ background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, overflow: 'hidden' }}>

      {/* ── BEFORE (always visible, grey/muted) ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f1f5f9',
      }}>
        {/* Before label */}
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
          fontSize: 14, fontWeight: 700, color: '#94a3b8', letterSpacing: '.1em',
          textTransform: 'uppercase', opacity: beforeOpacity,
        }}>Before Critup</div>

        <div style={{
          width: CARD_W, background: '#fff', borderRadius: 24, padding: '32px 28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
          opacity: cardOpacity, transform: `scale(${cardEntry})`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Analysis
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#cbd5e1', marginBottom: 6 }}>Your Project</div>
          <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 20 }}>Finalized Design</div>

          {/* Blurred scores */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <BlurScore label="Concept" />
            <BlurScore label="Spatial" />
            <BlurScore label="Presentation" />
          </div>

          {/* Blurred critique text */}
          {[90, 70, 80, 60].map((w, i) => (
            <div key={i} style={{ height: 10, background: '#e2e8f0', borderRadius: 99, marginBottom: 8, width: `${w}%`, filter: 'blur(2px)' }} />
          ))}

          {/* No feedback state */}
          <div style={{ marginTop: 20, textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🤷</div>
            <div style={{ fontSize: 13, color: '#cbd5e1' }}>No feedback yet</div>
          </div>
        </div>
      </div>

      {/* ── AFTER (revealed by wipe) ── */}
      <div style={{
        position: 'absolute', inset: 0,
        clipPath: `inset(0 ${width - dividerX}px 0 0)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fff',
      }}>
        {/* After label */}
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
          fontSize: 14, fontWeight: 700, color: ORANGE, letterSpacing: '.1em',
          textTransform: 'uppercase', opacity: afterOpacity, whiteSpace: 'nowrap',
        }}>After Critup ✓</div>

        <div style={{
          width: CARD_W, background: '#fff', borderRadius: 24, padding: '32px 28px',
          boxShadow: `0 8px 48px rgba(249,115,22,0.12), 0 4px 24px rgba(0,0,0,0.08)`,
          border: `1.5px solid rgba(249,115,22,0.25)`,
          opacity: cardOpacity, transform: `scale(${cardEntry})`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            AI Critique Complete
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Your Project</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Finalized Design</div>

          {/* Real scores */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <RealScore label="Concept"      val={8.5} color={ORANGE} />
            <RealScore label="Spatial"      val={7.2} color="rgb(239,68,68)" />
            <RealScore label="Presentation" val={9.1} color="rgb(34,197,94)" />
          </div>

          {/* Critique text lines */}
          {[
            { w: 92, opacity: 1 },
            { w: 85, opacity: 0.7 },
            { w: 78, opacity: 0.5 },
            { w: 55, opacity: 0.35 },
          ].map((l, i) => (
            <div key={i} style={{ height: 10, background: '#e2e8f0', borderRadius: 99, marginBottom: 8, width: `${l.w}%`, opacity: l.opacity }} />
          ))}

          {/* Score badge */}
          <div style={{ marginTop: 20, textAlign: 'center', padding: '16px', background: 'rgba(249,115,22,0.06)', borderRadius: 12, border: `1px solid rgba(249,115,22,0.2)` }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: ORANGE, lineHeight: 1 }}>8.5<span style={{ fontSize: 18, color: '#94a3b8' }}>/10</span></div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: 600 }}>Strong submission 🎯</div>
          </div>
        </div>
      </div>

      {/* ── Divider line ── */}
      {dividerX > 0 && dividerX < width && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: dividerX - 2, width: 4,
          background: `linear-gradient(to bottom, transparent, ${ORANGE} 20%, ${ORANGE} 80%, transparent)`,
          boxShadow: `0 0 20px rgba(249,115,22,0.6)`,
          zIndex: 10,
        }}>
          {/* Divider handle */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 44, height: 44, borderRadius: '50%',
            background: ORANGE, boxShadow: '0 0 24px rgba(249,115,22,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
        </div>
      )}
    </AbsoluteFill>
  )
}
