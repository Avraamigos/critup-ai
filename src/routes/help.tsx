import { useState } from 'react'
import { Search, ChevronDown, ChevronUp, MessageSquare, BookOpen, Video } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'

const FAQS = [
  { q: 'How many pages can I upload in a PDF?', a: 'Free plan supports up to 10 pages per analysis. Monthly and Yearly plans support unlimited pages.' },
  { q: 'What design disciplines does Critup support?', a: 'Architecture, Interior Architecture, Urban Design, and Landscape Architecture. More disciplines are coming soon.' },
  { q: 'How accurate is the AI scoring?', a: 'Scores are calibrated against common jury rubrics (concept clarity, spatial logic, presentation quality). They are a guide, not a grade — use them to identify weak points to address.' },
  { q: 'Can I re-analyse a project after making changes?', a: 'Yes — just upload the updated PDF from the project page. Each upload creates a new analysis snapshot so you can track improvement over time.' },
  { q: 'What language is the feedback delivered in?', a: 'You can choose English, Russian, or Turkish in Onboarding or Settings. The full critique and jury questions will be generated in your selected language.' },
  { q: 'Is my work kept private?', a: 'Your uploaded PDFs and analyses are private to your account. We do not share or use your design work to train models.' },
  { q: 'How do I practise jury questions?', a: 'Go to Jury Practice in the sidebar. You can select questions generated from your project and record your answer — the AI will give feedback on timing and clarity.' },
  { q: 'When will paid plans launch?', a: "We're currently in open beta — all features are free. Payments are coming soon. You'll be notified before anything changes." },
]

const GUIDES = [
  { icon: '📐', title: 'Getting your first critique', desc: 'Upload your PDF and get a full analysis in under 2 minutes.' },
  { icon: '🎯', title: 'Jury Practice guide', desc: 'How to use recording and feedback to prepare effectively.' },
  { icon: '📊', title: 'Understanding your scores', desc: 'What C/S/P scores mean and how to improve each.' },
  { icon: '🗣️', title: 'Preparing your opening statement', desc: 'Use the AI assistant to refine how you present your concept.' },
]

export function HelpPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const filtered = FAQS.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 36px', fontFamily: "'Inter',sans-serif", maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: '0 0 4px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>Help & Support</h1>
      <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 28px' }}>Find answers or get in touch</p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <Search size={15} color={c.textMuted} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search for answers…"
          style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, boxSizing: 'border-box', background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif" }}
          onFocus={e => e.target.style.borderColor = '#F97316'}
          onBlur={e => e.target.style.borderColor = c.border}
        />
      </div>

      {/* Quick guides */}
      {!search && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, margin: '0 0 14px', letterSpacing: '-0.01em' }}>Quick guides</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {GUIDES.map(g => (
              <div key={g.title} style={{ background: c.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c.border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#F97316'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px oklch(0.72 0.18 45 / 0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c.border; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: 22, marginBottom: 8 }}>{g.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 3 }}>{g.title}</div>
                <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.4 }}>{g.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
          {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'Frequently asked questions'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((faq, i) => (
            <div key={i} style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden', transition: 'border 0.15s' }}>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, textAlign: 'left' }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary }}>{faq.q}</span>
                {expanded === i ? <ChevronUp size={15} color={c.textMuted} style={{ flexShrink: 0 }} /> : <ChevronDown size={15} color={c.textMuted} style={{ flexShrink: 0 }} />}
              </button>
              {expanded === i && (
                <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${c.border}` }}>
                  <p style={{ fontSize: 13, color: c.textMuted, margin: '12px 0 0', lineHeight: 1.6 }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ fontSize: 14, color: c.textMuted, textAlign: 'center', padding: '24px 0' }}>No results for "{search}"</p>
          )}
        </div>
      </div>

      {/* Contact */}
      <div style={{ marginTop: 32, background: c.cardBg, borderRadius: 18, padding: '20px 22px', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, margin: '0 0 3px' }}>Still need help?</p>
          <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>We respond within one business day</p>
        </div>
        <a href="mailto:hello@critup.ai" style={{ padding: '10px 20px', borderRadius: 100, background: '#F97316', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 16px oklch(0.72 0.18 45 / 0.3)' }}>
          Email us →
        </a>
      </div>
    </div>
  )
}
