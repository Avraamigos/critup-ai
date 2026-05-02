import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { AI_REPLIES, MOCK_USER } from '@/lib/mock-data'

interface Msg { role: 'user' | 'ai'; text: string; ts: string }

const CHIPS = [
  "What's my weakest area?",
  'How should I open my jury presentation?',
  'What will the jury ask first?',
  'Improve my concept statement',
]

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function AssistantPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: `Hi ${MOCK_USER.name.split(' ')[0]}! I've analysed your Riverside Cultural Pavilion. Ask me anything about your project — jury questions, design decisions, or how to improve your scores.`, ts: now() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const replyIdx = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const send = (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Msg = { role: 'user', text: text.trim(), ts: now() }
    setMsgs(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    setTimeout(() => {
      const reply = AI_REPLIES[replyIdx.current % AI_REPLIES.length]
      replyIdx.current++
      setMsgs(m => [...m, { role: 'ai', text: reply, ts: now() }])
      setLoading(false)
    }, 1200 + Math.random() * 600)
  }

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: `1px solid ${c.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color="#F97316" />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>AI Project Assistant</h1>
          <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>Knows your project inside out · Riverside Cultural Pavilion</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
            {m.role === 'ai' && (
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={13} color="#F97316" />
              </div>
            )}
            <div style={{ maxWidth: '72%' }}>
              <div style={{
                padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? '#F97316' : c.cardBg,
                border: m.role === 'user' ? 'none' : `1px solid ${c.border}`,
                color: m.role === 'user' ? '#fff' : c.textPrimary,
                fontSize: 14, lineHeight: 1.6,
              }}>
                {m.text}
              </div>
              <div style={{ fontSize: 11, color: c.textMuted, marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.ts}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={13} color="#F97316" />
            </div>
            <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: c.cardBg, border: `1px solid ${c.border}`, display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c.textMuted, animation: 'bounce-dot 0.8s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      {msgs.length <= 1 && (
        <div style={{ padding: '0 28px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {CHIPS.map(chip => (
            <button key={chip} onClick={() => send(chip)} style={{
              padding: '7px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`,
              color: c.textMuted, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#F97316'; (e.currentTarget as HTMLButtonElement).style.color = '#F97316' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = c.border; (e.currentTarget as HTMLButtonElement).style.color = c.textMuted }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 28px 20px', borderTop: `1px solid ${c.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, background: c.cardBg, border: `1.5px solid ${c.border}`, borderRadius: 14, padding: '8px 8px 8px 16px', transition: 'border 0.15s' }}
          onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#F97316'}
          onBlurCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = c.border}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask anything about your project…"
            rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: c.textPrimary, fontSize: 14, resize: 'none', fontFamily: "'Inter',sans-serif", lineHeight: 1.5, paddingTop: 4 }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36, height: 36, borderRadius: 10, background: input.trim() && !loading ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'),
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <Send size={15} color={input.trim() && !loading ? '#fff' : c.textMuted} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: c.textMuted, margin: '6px 0 0', textAlign: 'center' }}>Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
