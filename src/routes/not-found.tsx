import { Link } from '@tanstack/react-router'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.035)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

export function NotFoundPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: c.bg, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      {c.isDark && <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '50%', background: 'radial-gradient(ellipse, oklch(0.72 0.18 45 / 0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />}

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <CritupLogo size={24} showText theme={theme} />
        </div>

        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: '-0.05em', color: 'transparent', backgroundImage: 'linear-gradient(135deg, #F97316 0%, oklch(0.72 0.18 45) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', lineHeight: 1, marginBottom: 16, fontFamily: FONT }}>
          404
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: c.textPrimary, margin: '0 0 10px', letterSpacing: '-0.025em', fontFamily: FONT }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 36px', lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
          This page doesn't exist. Maybe the URL is wrong, or the page was moved.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ padding: '11px 28px', borderRadius: 100, background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.35)' }}>
            Go to dashboard
          </Link>
          <Link to="/landing" style={{ padding: '11px 28px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
