import { Link } from '@tanstack/react-router'
import { Eye, Plus, ArrowRight, Mic, Sparkles, TrendingUp, Calendar } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { useTheme, useColors } from '@/lib/theme'
import { MOCK_PROJECTS } from '@/lib/mock-data'
import { useEffect, useState } from 'react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

export function DashboardPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const isMobile = useIsMobile()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const active = MOCK_PROJECTS[0]
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '28px', maxWidth: 1080, position: 'relative' }}>
      {c.isDark && <div style={{ position: 'fixed', top: 0, right: 0, width: '55%', height: '45%', background: 'radial-gradient(ellipse 60% 40% at 70% 10%, oklch(0.72 0.18 45 / 0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />}

      {/* Welcome */}
      <div style={{ marginBottom: isMobile ? 20 : 28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 6 : 10, marginBottom: 3 }}>
          <h1 style={{ fontSize: isMobile ? 26 : 24, fontWeight: 700, letterSpacing: '-0.025em', margin: 0, color: c.textPrimary, fontFamily: FONT }}>
            {greeting}, Alex
          </h1>
          <div style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'oklch(0.72 0.18 45 / 0.1)', color: '#F97316', border: '1px solid oklch(0.72 0.18 45 / 0.25)', alignSelf: 'flex-start' }}>
            Architecture Student
          </div>
        </div>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>Your jury is in 12 days. Let's get you ready.</p>
      </div>

      {/* Top row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
        gap: isMobile ? 12 : 18,
        marginBottom: isMobile ? 12 : 20,
        position: 'relative', zIndex: 1,
      }}>
        {/* Active project */}
        <div style={{
          gridColumn: isMobile ? '1' : '1 / 3',
          background: c.cardBg, borderRadius: 18, padding: isMobile ? '18px' : '24px',
          border: `1px solid ${c.border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? 16 : 20 }}>
            <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Active project</div>
              <h2 style={{ fontSize: isMobile ? 16 : 17, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px', color: c.textPrimary, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {active.name}
              </h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ padding: '3px 9px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: 'oklch(0.72 0.18 45 / 0.1)', color: '#F97316', border: '1px solid oklch(0.72 0.18 45 / 0.25)', whiteSpace: 'nowrap' }}>
                  {active.stage}
                </div>
                <span style={{ fontSize: 11, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} color={c.textMuted} /> {active.daysAgo}
                </span>
              </div>
            </div>
            <Link to="/analysis/$projectId" params={{ projectId: active.id }} style={{
              padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 14px oklch(0.72 0.18 45 / 0.35)',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Inter',sans-serif", textDecoration: 'none',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <Eye size={13} color="#fff" />{!isMobile && ' View analysis'}
              {isMobile && ' Analyse'}
            </Link>
          </div>
          <div style={{ display: 'flex', gap: isMobile ? 12 : 20 }}>
            <ScoreRing score={active.scores.concept} label="Concept" size={isMobile ? 72 : 82} theme={theme} />
            <ScoreRing score={active.scores.spatial} label="Spatial" size={isMobile ? 72 : 82} theme={theme} />
            <ScoreRing score={active.scores.presentation} label="Presentation" size={isMobile ? 72 : 82} theme={theme} />
          </div>
        </div>

        {/* New project */}
        <Link to="/projects/new" style={{
          background: c.cardBg, borderRadius: 18, padding: isMobile ? '18px' : '24px',
          border: `1px solid ${c.border}`,
          cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: isMobile ? 'row' : 'column',
          justifyContent: isMobile ? 'space-between' : 'space-between',
          alignItems: isMobile ? 'center' : 'flex-start',
          textDecoration: 'none',
          minHeight: isMobile ? 'auto' : undefined,
        }}
          onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${c.hoverBorder}`; e.currentTarget.style.boxShadow = '0 0 28px oklch(0.72 0.18 45 / 0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${c.border}`; e.currentTarget.style.boxShadow = 'none' }}
        >
          {c.isDark && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 20%, oklch(0.72 0.18 45 / 0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />}
          <div style={{ display: 'flex', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 12 : 0, flexDirection: isMobile ? 'row' : 'column' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'oklch(0.72 0.18 45 / 0.1)', border: '1px solid oklch(0.72 0.18 45 / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? 0 : 14, flexShrink: 0 }}>
              <Plus size={18} color="#F97316" />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', margin: isMobile ? 0 : '0 0 6px', color: c.textPrimary, fontFamily: FONT }}>{isMobile ? 'New project' : 'New project'}</h3>
              {!isMobile && <p style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5, margin: 0 }}>Upload your brief and get stage-specific feedback</p>}
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#F97316', fontWeight: 600, marginTop: isMobile ? 0 : 18, display: 'flex', alignItems: 'center', gap: 4 }}>
            Start <ArrowRight size={13} color="#F97316" />
          </div>
        </Link>
      </div>

      {/* Quick actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
        gap: isMobile ? 10 : 14,
        marginBottom: isMobile ? 20 : 28,
        position: 'relative', zIndex: 1,
      }}>
        {[
          { icon: Mic, label: 'Jury Practice', sub: '8 questions ready', to: '/jury' },
          { icon: Sparkles, label: 'AI Assistant', sub: 'Continue conversation', to: '/assistant' },
          { icon: TrendingUp, label: 'Score History', sub: 'Improving over time', to: '/projects' },
        ].map(({ icon: Icon, label, sub, to }) => (
          <Link key={label} to={to} style={{
            background: c.cardBg, borderRadius: 14, padding: isMobile ? '14px' : '16px 18px',
            border: `1px solid ${c.border}`,
            display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 8 : 12,
            cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.hoverBorder; e.currentTarget.style.background = c.isDark ? 'oklch(0.235 0.004 270)' : '#f9fafb' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = c.cardBg }}
          >
            <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f3f4f6', borderRadius: 9, flexShrink: 0 }}>
              <Icon size={16} color="#F97316" strokeWidth={1.6} />
            </div>
            <div>
              <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: c.textPrimary, marginBottom: 1 }}>{label}</div>
              <div style={{ fontSize: 11, color: c.textMuted }}>{sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: c.textPrimary }}>Recent projects</h3>
          <Link to="/projects" style={{ background: 'none', border: 'none', color: '#F97316', fontSize: 12, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
            View all <ArrowRight size={12} color="#F97316" />
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MOCK_PROJECTS.slice(0, isMobile ? 2 : 3).map((p) => (
            <Link key={p.id} to="/analysis/$projectId" params={{ projectId: p.id }} style={{
              background: c.cardBg, borderRadius: 13, padding: isMobile ? '12px 14px' : '14px 18px',
              border: `1px solid ${c.border}`,
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = c.hoverBorder}
              onMouseLeave={e => e.currentTarget.style.borderColor = c.border}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <div style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${p.stageColor}18`, color: p.stageColor, border: `1px solid ${p.stageColor}40`, whiteSpace: 'nowrap' }}>{p.stage}</div>
                  <span style={{ fontSize: 11, color: c.textMuted }}>{p.daysAgo}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: isMobile ? 10 : 14, flexShrink: 0 }}>
                {([['C', p.scores.concept], ['S', p.scores.spatial], ['P', p.scores.presentation]] as [string, number][]).map(([l, v]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: v >= 8 ? 'oklch(0.72 0.17 145)' : v >= 6 ? '#F97316' : 'oklch(0.65 0.18 25)' }}>{v}</div>
                    <div style={{ fontSize: 9, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
