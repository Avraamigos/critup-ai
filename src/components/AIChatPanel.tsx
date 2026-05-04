import { useEffect, useRef, useState } from 'react'
import { Send, X, Sparkles, ChevronDown } from 'lucide-react'
import { useColors } from '@/lib/theme'
import { AI_REPLIES } from '@/lib/mock-data'

interface Props {
  open: boolean
  onClose: () => void
  theme: 'dark' | 'light'
}

interface Message {
  role: 'ai' | 'user'
  text: string
}

const CHIPS = ['Explain my critique', 'Jury prep help', 'Weakest point?', 'Improve concept']

export function AIChatPanel({ open, onClose, theme }: Props) {
  const c = useColors(theme)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hi! I've reviewed your latest project. Your spatial score is strong. Would you like me to walk you through the key critique points or help you prep for jury questions?" },
  ])
  const [loading, setLoading] = useState(false)
  const endRef  = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const send = (text: string) => {
    if (!text.trim() || loading) return
    setMessages(m => [...m, { role: 'user', text }])
    setInput('')
    setLoading(true)
    setTimeout(() => {
      setMessages(m => [...m, { role: 'ai', text: AI_REPLIES[Math.floor(Math.random() * AI_REPLIES.length)] }])
      setLoading(false)
    }, 1100)
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  if (!open) return null

  const isDark = theme === 'dark'
  const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

  return (
    <>
      <style>{`
        @keyframes ai-slide-in  { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes msg-pop      { from { opacity:0; transform:translateY(6px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes dot-bounce   { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
        @keyframes glow-pulse   { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
      `}</style>

      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 360, zIndex: 8000,
        background: isDark ? 'oklch(0.155 0.006 270)' : '#ffffff',
        borderLeft: `1px solid ${isDark ? 'oklch(0.24 0.006 270)' : '#e5e7eb'}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: isDark ? '-16px 0 48px rgba(0,0,0,0.4)' : '-8px 0 32px rgba(0,0,0,0.08)',
        fontFamily: FONT,
        animation: 'ai-slide-in 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '16px 18px',
          background: isDark
            ? 'linear-gradient(135deg, oklch(0.19 0.006 270) 0%, oklch(0.175 0.01 35) 100%)'
            : 'linear-gradient(135deg, #fff7ed 0%, #fff 60%)',
          borderBottom: `1px solid ${isDark ? 'oklch(0.24 0.006 270)' : '#fde8d0'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute', top: -20, right: -20, width: 120, height: 120,
            background: 'radial-gradient(circle, oklch(0.72 0.18 45/0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            {/* AI Avatar */}
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #F97316 0%, oklch(0.65 0.22 35) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px oklch(0.72 0.18 45 / 0.4)',
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.01em' }}>
                AI Critic
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'oklch(0.72 0.17 145)',
                  animation: 'glow-pulse 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 11, color: '#F97316', fontWeight: 500 }}>Online · Ready to help</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: isDark ? 'oklch(0.28 0.006 270)' : '#f3f4f6',
              border: 'none', cursor: 'pointer', color: c.textMuted,
              padding: 6, borderRadius: 8, display: 'flex', transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'oklch(0.32 0.006 270)' : '#e5e7eb')}
            onMouseLeave={e => (e.currentTarget.style.background = isDark ? 'oklch(0.28 0.006 270)' : '#f3f4f6')}
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflow: 'auto', padding: '16px 14px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 8, alignItems: 'flex-end',
                animation: 'msg-pop 0.22s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              {m.role === 'ai' && (
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #F97316, oklch(0.65 0.22 35))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px oklch(0.72 0.18 45 / 0.3)',
                }}>
                  <Sparkles size={12} color="#fff" />
                </div>
              )}

              <div style={{
                maxWidth: '78%',
                padding: m.role === 'user' ? '10px 14px' : '11px 14px',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                background: m.role === 'user'
                  ? 'linear-gradient(135deg, #F97316 0%, oklch(0.65 0.22 35) 100%)'
                  : (isDark ? 'oklch(0.21 0.006 270)' : '#f8fafc'),
                border: m.role === 'user'
                  ? 'none'
                  : `1px solid ${isDark ? 'oklch(0.265 0.006 270)' : '#e2e8f0'}`,
                boxShadow: m.role === 'user'
                  ? '0 4px 16px oklch(0.72 0.18 45 / 0.3)'
                  : (isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)'),
                fontSize: 13, lineHeight: 1.55,
                color: m.role === 'user' ? '#fff' : (isDark ? '#e2e8f0' : '#1e293b'),
              }}>
                {m.text}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', animation: 'msg-pop 0.22s ease' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #F97316, oklch(0.65 0.22 35))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={12} color="#fff" />
              </div>
              <div style={{
                padding: '13px 16px',
                background: isDark ? 'oklch(0.21 0.006 270)' : '#f8fafc',
                border: `1px solid ${isDark ? 'oklch(0.265 0.006 270)' : '#e2e8f0'}`,
                borderRadius: '4px 18px 18px 18px',
                display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#F97316',
                    animation: `dot-bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* ── Chips ── */}
        <div style={{ padding: '6px 14px 0', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          {CHIPS.map(ch => (
            <button
              key={ch}
              onClick={() => send(ch)}
              style={{
                padding: '5px 11px', borderRadius: 100,
                background: isDark ? 'oklch(0.21 0.006 270)' : '#f8fafc',
                border: `1px solid ${isDark ? 'oklch(0.28 0.006 270)' : '#e2e8f0'}`,
                color: c.textMuted, fontSize: 11, cursor: 'pointer',
                fontFamily: FONT, transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#F97316'
                e.currentTarget.style.color = '#F97316'
                e.currentTarget.style.background = isDark ? 'oklch(0.72 0.18 45/0.1)' : '#fff7ed'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = isDark ? 'oklch(0.28 0.006 270)' : '#e2e8f0'
                e.currentTarget.style.color = c.textMuted
                e.currentTarget.style.background = isDark ? 'oklch(0.21 0.006 270)' : '#f8fafc'
              }}
            >{ch}</button>
          ))}
        </div>

        {/* ── Input ── */}
        <div style={{ padding: '10px 14px 16px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: isDark ? 'oklch(0.21 0.006 270)' : '#f8fafc',
            borderRadius: 16,
            border: `1.5px solid ${input.trim()
              ? '#F97316'
              : (isDark ? 'oklch(0.28 0.006 270)' : '#e2e8f0')}`,
            padding: '10px 12px 10px 16px',
            transition: 'border-color 0.2s',
            boxShadow: input.trim() ? '0 0 0 3px oklch(0.72 0.18 45/0.12)' : 'none',
          }}>
            <textarea
              ref={textRef}
              value={input}
              onChange={handleInput}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
              }}
              placeholder="Ask anything about your project…"
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                resize: 'none', fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b',
                fontFamily: FONT, lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #F97316, oklch(0.65 0.22 35))'
                  : (isDark ? 'oklch(0.28 0.006 270)' : '#e5e7eb'),
                border: 'none',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: input.trim() && !loading ? '0 4px 12px oklch(0.72 0.18 45/0.35)' : 'none',
              }}
            >
              <Send size={14} color={input.trim() && !loading ? '#fff' : c.textMuted} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: c.textMuted, textAlign: 'center', marginTop: 8 }}>
            Shift+Enter for new line · Enter to send
          </div>
        </div>
      </div>
    </>
  )
}
