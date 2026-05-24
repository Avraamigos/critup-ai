import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Check, Lock, X } from 'lucide-react'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'
import { track } from '@/lib/analytics'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

function PaywallModal({ open, onClose, theme }: { open: boolean; onClose: () => void; theme: 'dark' | 'light' }) {
  const c = useColors(theme)
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: c.cardBg, borderRadius: 20, padding: '36px 40px', maxWidth: 420, width: '90%', border: `1px solid ${c.border}`, textAlign: 'center', position: 'relative' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <Lock size={22} color="#F97316" />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px', color: c.textPrimary }}>Coming soon</h3>
        <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6, margin: '0 0 24px' }}>Payments are launching soon. For now, enjoy full access to all features free while we're in beta.</p>
        <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: 10, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 20px oklch(0.72 0.18 45 / 0.35)' }}>Got it — keep exploring</button>
      </div>
    </div>
  )
}

export function PricingPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const [paywallOpen, setPaywallOpen] = useState(false)

  const plans = [
    {
      name: 'Free', price: '$0', sub: '',
      features: ['1 complete AI critique', 'Concept, Spatial & Presentation scores', 'PDF upload (up to 10 pages)', 'Basic jury questions'],
      cta: 'Continue free', featured: false, action: () => navigate({ to: '/' }),
    },
    {
      name: 'Monthly', price: '$9', sub: '/mo', cancel: 'Cancel anytime',
      features: ['Unlimited project analyses', 'Voiceover narration (page by page)', 'Jury Q&A simulation', 'AI project assistant', 'Progress history', 'Multi-language support'],
      cta: 'Start monthly', featured: true, badge: 'Most popular', action: () => { track.upgradeClicked('pricing_monthly'); setPaywallOpen(true) },
    },
    {
      name: 'Yearly', price: '$59', sub: '/yr', crossed: '$108', save: 'Save 45%',
      features: ['Everything in Monthly', 'Video presentation coach', 'Priority processing', 'Early access to new features'],
      cta: 'Start yearly', featured: false, badge: 'Best value', action: () => { track.upgradeClicked('pricing_yearly'); setPaywallOpen(true) },
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Inter',sans-serif", color: c.textPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px 48px', position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '70%', height: '45%', background: 'radial-gradient(ellipse, oklch(0.72 0.18 45 / 0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}><CritupLogo size={22} theme={theme} /></div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 10 }}>CHOOSE YOUR PLAN</div>
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>Start free. Upgrade when you're ready.</h1>
        <p style={{ fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 48 }}>One free project analysis included. No card required.</p>

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          {plans.map(({ name, price, sub, cancel, crossed, save, features, cta, featured, badge, action }) => (
            <div key={name} style={{
              background: c.cardBg, borderRadius: 22, padding: '32px 28px',
              border: featured ? '1.5px solid #F97316' : `1px solid ${c.border}`,
              boxShadow: featured ? '0 0 50px oklch(0.72 0.18 45 / 0.14)' : 'none',
              position: 'relative', width: 268, transform: featured ? 'scale(1.02)' : 'scale(1)',
            }}>
              {badge && <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: featured ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'), padding: '4px 16px', borderRadius: 100, fontSize: 11, fontWeight: 700, color: featured ? '#fff' : c.textMuted, whiteSpace: 'nowrap' }}>{badge}</div>}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', marginBottom: 14, letterSpacing: '0.06em' }}>{name.toUpperCase()}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 50, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", letterSpacing: '-0.04em', lineHeight: 1, color: c.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{price}</span>
                <span style={{ fontSize: 15, color: c.textMuted }}>{sub}</span>
              </div>
              {cancel && <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 2 }}>{cancel}</div>}
              {crossed && <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 2 }}><span style={{ textDecoration: 'line-through' }}>{crossed}</span><span style={{ color: 'oklch(0.72 0.17 145)', marginLeft: 6, fontWeight: 600 }}>{save}</span></div>}
              <div style={{ height: 1, background: c.border, margin: '16px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Check size={14} color="oklch(0.72 0.17 145)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={action} style={{
                width: '100%', padding: '12px 0', borderRadius: 100, cursor: 'pointer',
                background: featured ? '#F97316' : 'transparent',
                border: featured ? 'none' : `1.5px solid ${c.border}`,
                color: featured ? '#fff' : c.textPrimary,
                fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
                boxShadow: featured ? '0 0 22px oklch(0.72 0.18 45 / 0.4)' : 'none',
              }}>{cta}</button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => navigate({ to: '/' })} style={{ background: 'none', border: 'none', color: c.textMuted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Continue with free →</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: c.isDark ? 'oklch(0.45 0.004 270)' : '#9ca3af' }}>
          Questions? <a href="mailto:hello@critup.ai" style={{ color: '#F97316' }}>hello@critup.ai</a>
        </div>
      </div>
      <PaywallModal open={paywallOpen} onClose={() => navigate({ to: '/' })} theme={theme} />
    </div>
  )
}
