import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { AIOrb } from '@/components/AIOrb'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface Msg { role: 'user' | 'ai'; text: string; ts: string }

const CHIPS = [
  "What's my weakest area?",
  'How should I open my jury presentation?',
  'What will the jury ask first?',
  'Improve my concept statement',
]

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// ─── API helpers ──────────────────────────────────────────────────────────────

interface LatestAnalysis {
  id: string
  projectName: string
}

async function loadLatestAnalysis(userId: string): Promise<LatestAnalysis | null> {
  try {
    const { data } = await supabase
      .from('analyses')
      .select('id, projects(name)')
      .eq('user_id', userId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = (data as any).projects as { name: string } | null
    return { id: data.id as string, projectName: project?.name ?? 'Your Project' }
  } catch {
    return null
  }
}

async function sendToAPI(msgs: Msg[], analysisId: string | null): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysisId: analysisId ?? undefined,
      messages: msgs.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      })),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }

  const data = await res.json() as { reply?: string }
  return data.reply ?? ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssistantPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const { user } = useAuth()

  const [latestAnalysis, setLatestAnalysis] = useState<LatestAnalysis | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load latest analysis on mount
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    loadLatestAnalysis(user.id).then(analysis => {
      if (cancelled) return
      setLatestAnalysis(analysis)
      const greeting = analysis
        ? `Hi! I've analysed **${analysis.projectName}**. Ask me anything — jury questions, score breakdowns, how to improve your design.`
        : "Hi! Upload a project to get started. I'll analyse your drawings and give you targeted critique, score breakdowns, and jury prep."
      setMsgs([{ role: 'ai', text: greeting, ts: now() }])
    })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Msg = { role: 'user', text: text.trim(), ts: now() }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const reply = await sendToAPI(newMsgs, latestAnalysis?.id ?? null)
      setMsgs(m => [...m, { role: 'ai', text: reply, ts: now() }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setMsgs(newMsgs.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: `1px solid ${c.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <AIOrb size={40} float={true} />
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>AI Project Assistant</h1>
          <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>
            {latestAnalysis
              ? `Knows your project inside out · ${latestAnalysis.projectName}`
              : 'Upload a project to unlock personalised advice'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
            {m.role === 'ai' && <AIOrb size={30} />}
            <div style={{ maxWidth: '72%' }}>
              <div style={{
                padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? '#F97316' : c.cardBg,
                border: m.role === 'user' ? 'none' : `1px solid ${c.border}`,
                color: m.role === 'user' ? '#fff' : c.textPrimary,
                fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {m.text}
              </div>
              <div style={{ fontSize: 11, color: c.textMuted, marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.ts}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <AIOrb size={30} />
            <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: c.cardBg, border: `1px solid ${c.border}`, display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c.textMuted, animation: 'bounce-dot 0.8s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 16px', borderRadius: 10, background: c.isDark ? 'oklch(0.18 0.06 25)' : '#fef2f2', border: `1px solid ${c.isDark ? 'oklch(0.35 0.1 25)' : '#fecaca'}`, color: c.isDark ? '#fca5a5' : '#dc2626', fontSize: 13 }}>
            ⚠️ {error} — please try again
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      {msgs.length <= 1 && (
        <div style={{ padding: '0 28px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {CHIPS.map(chip => (
            <button key={chip} onClick={() => send(chip)} disabled={loading} style={{
              padding: '7px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`,
              color: c.textMuted, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: loading ? 0.5 : 1,
            }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget).style.borderColor = '#F97316'; (e.currentTarget).style.color = '#F97316' } }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = c.border; (e.currentTarget).style.color = c.textMuted }}
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
