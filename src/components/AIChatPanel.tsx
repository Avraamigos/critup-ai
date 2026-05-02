import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { BlobButton } from './BlobButton'
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

export function AIChatPanel({ open, onClose, theme }: Props) {
  const c = useColors(theme)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hi Alex — I've reviewed your Riverside Cultural Pavilion. Your spatial logic is strong at 8.1. The key issues are the missing section datum and gallery ceiling inconsistency. What would you like to work on?" },
  ])
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const chips = ['Explain my critique', 'Jury prep help', 'Weakest point?', 'Improve concept']

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
  }, [messages])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 360, zIndex: 8000,
      background: c.cardBg, borderLeft: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 40px rgba(0,0,0,0.2)',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BlobButton onClick={() => {}} size={30} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>AI Assistant</div>
            <div style={{ fontSize: 11, color: c.textMuted }}>Riverside Cultural Pavilion</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 4, borderRadius: 6, display: 'flex' }}>
          <X size={16} color={c.textMuted} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-start' }}>
            {m.role === 'ai' && (
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, oklch(0.65 0.20 35))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 2 }}>AI</div>
            )}
            <div style={{
              maxWidth: '80%', padding: '10px 13px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? 'oklch(0.72 0.18 45 / 0.15)' : (c.isDark ? 'oklch(0.19 0.004 270)' : '#f3f4f6'),
              border: m.role === 'user' ? '1px solid oklch(0.72 0.18 45 / 0.3)' : `1px solid ${c.border}`,
              fontSize: 13, lineHeight: 1.55, color: c.textPrimary,
            }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, oklch(0.65 0.20 35))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AI</div>
            <div style={{ padding: '12px 14px', background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f3f4f6', borderRadius: '16px 16px 16px 4px', border: `1px solid ${c.border}`, display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => <div key={i} className={`bounce-dot-${i}`} style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316' }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ padding: '8px 14px 0', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {chips.map(ch => (
          <button key={ch} onClick={() => send(ch)} style={{
            padding: '4px 10px', borderRadius: 100, background: 'transparent',
            border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted }}
          >{ch}</button>
        ))}
      </div>

      <div style={{ padding: '10px 14px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: c.inputBg, borderRadius: 12, border: `1px solid ${c.border}`, padding: '8px 10px 8px 14px' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask anything…" rows={2}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 13, color: c.textPrimary, fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}
          />
          <button
            onClick={() => send(input)}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: input.trim() ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'),
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
            }}
          >
            <Send size={14} color={input.trim() ? '#fff' : c.textMuted} />
          </button>
        </div>
      </div>
    </div>
  )
}
