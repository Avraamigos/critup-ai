import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, ORANGE } from './constants'

const MESSAGES = [
  { role: 'ai',   text: "Hi! I've finished analysing Riverside Cultural Pavilion. Your strongest move is the sectional relationship — the jury will love it. Want me to walk you through the weakest points first?" },
  { role: 'user', text: "Yes, what should I fix before jury?" },
  { role: 'ai',   text: "Focus on two things: 1) The entry threshold — compress before the gallery void to create drama. 2) Add a detail drawing of the roof fold connection. Juries always push on tectonic honesty." },
  { role: 'user', text: "What question will they ask about my concept?" },
  { role: 'ai',   text: "Expect: \"How does the industrial vocabulary serve the civic program rather than just reference it?\" — prepare a 30-second answer connecting your material palette to community memory." },
]

// Each message appears at these second marks
const APPEAR_AT = [0.3, 2.2, 3.6, 5.8, 7.2]

function OrbMini() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const glow = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2 / 3)
  const blink = (Math.floor(frame % (fps * 5)) >= fps * 4.7) ? 0.08 : 1

  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
      boxShadow: `0 0 ${10 + glow * 14}px rgba(249,115,22,${0.35 + glow * 0.3})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      alignSelf: 'flex-end',
    }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ width: 5, height: 9, borderRadius: 99, background: '#fff', transform: `scaleY(${blink})`, transformOrigin: 'center' }} />
        ))}
      </div>
    </div>
  )
}

function TypingDots() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <OrbMini />
      <div style={{
        padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: '4px 22px 22px 22px',
        display: 'flex', gap: 7, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => {
          const bounce = Math.sin(((frame / fps) * Math.PI * 2 * 1.5) - i * 0.5) * 0.5 + 0.5
          return (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%', background: ORANGE,
              transform: `translateY(${-bounce * 6}px)`,
            }} />
          )
        })}
      </div>
    </div>
  )
}

export function ChatComp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Which messages are visible
  const visibleCount = APPEAR_AT.filter(t => frame >= t * fps).length

  // Header
  const headerEntry = spring({ frame, fps, config: { damping: 14 } })
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  // Show typing dots between AI messages when next hasn't appeared yet
  const nextIsAi = visibleCount < MESSAGES.length && MESSAGES[visibleCount]?.role === 'ai'
  const timeSinceLast = visibleCount > 0 ? frame - APPEAR_AT[visibleCount - 1] * fps : 0
  const showDots = nextIsAi && timeSinceLast > fps * 0.3

  return (
    <AbsoluteFill style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ width: 680, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Chat header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          background: '#fff', borderRadius: '20px 20px 0 0', padding: '18px 22px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', borderBottom: 'none',
          opacity: headerOpacity, transform: `translateY(${(1 - headerEntry) * -10}px)`,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
            boxShadow: '0 0 20px rgba(249,115,22,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1].map(i => <div key={i} style={{ width: 5, height: 9, borderRadius: 99, background: '#fff' }} />)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Crit</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Online · AI Jury Assistant</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          background: '#fafafa', border: '1px solid #e2e8f0', borderTop: 'none',
          borderRadius: '0 0 20px 20px', padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: 460,
        }}>
          {MESSAGES.slice(0, visibleCount).map((msg, i) => {
            const msgFrame = frame - APPEAR_AT[i] * fps
            const msgEntry = spring({ frame: msgFrame, fps, config: { damping: 14, stiffness: 100 } })
            const msgOpacity = interpolate(msgFrame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
            const isUser = msg.role === 'user'

            return (
              <div key={i} style={{
                display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
                gap: 10, alignItems: 'flex-end',
                opacity: msgOpacity,
                transform: `translateY(${(1 - msgEntry) * 12}px)`,
              }}>
                {!isUser && <OrbMini />}
                <div style={{
                  maxWidth: '75%', padding: '13px 17px',
                  borderRadius: isUser ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                  background: isUser ? `linear-gradient(135deg, ${ORANGE} 0%, #e05500 100%)` : '#fff',
                  border: isUser ? 'none' : '1px solid #e2e8f0',
                  boxShadow: isUser ? '0 4px 20px rgba(249,115,22,.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                  fontSize: 15, lineHeight: 1.6,
                  color: isUser ? '#fff' : '#1e293b',
                }}>
                  {msg.text}
                </div>
              </div>
            )
          })}

          {showDots && <TypingDots />}
        </div>
      </div>
    </AbsoluteFill>
  )
}
