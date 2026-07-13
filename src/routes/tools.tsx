import { useNavigate } from '@tanstack/react-router'
import { Sparkles, ArrowRight, Wand2 } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { useIsMobile } from '@/lib/useIsMobile'
import { MONO } from '@/lib/fonts'

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

const TOOLS = [
  {
    id: 'poster', to: '/tools/poster', live: true,
    icon: Sparkles, name: 'Title Poster',
    desc: 'Turn your building render into a polished presentation title slide — choose a vibe, upload your render, done.',
    tag: 'Pro',
  },
  // Future tools land here (diagram generator, checklist, title-block formatter…)
]

export function ToolsPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  return (
    <div style={{ padding: isMobile ? '20px 16px 60px' : '28px 32px 60px', maxWidth: 1000, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <Wand2 size={19} color={c.orange} />
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: 0 }}>Tools</h1>
      </div>
      <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 26px', maxWidth: '58ch', lineHeight: 1.55 }}>
        A growing kit of fast utilities for design students. More coming — this is just the start.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => navigate({ to: tool.to })} style={{
            textAlign: 'left', background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16,
            padding: 22, cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s', position: 'relative',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.orange; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'oklch(0.72 0.18 45/0.1)', border: '1px solid oklch(0.72 0.18 45/0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tool.icon size={19} color={c.orange} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.orange, background: 'oklch(0.72 0.18 45/0.12)', padding: '3px 8px', borderRadius: 100 }}>{tool.tag}</span>
            </div>
            <div style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: '-0.02em', color: c.textPrimary, marginBottom: 5 }}>{tool.name}</div>
            <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.55, margin: '0 0 14px' }}>{tool.desc}</p>
            <span style={{ fontSize: 13, fontWeight: 600, color: c.orange, display: 'flex', alignItems: 'center', gap: 5 }}>
              Open <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
