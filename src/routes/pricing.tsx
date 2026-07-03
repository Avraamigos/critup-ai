import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '@/lib/useIsMobile'
import { Link, useNavigate } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'
import { track } from '@/lib/analytics'
import { useAuth } from '@/lib/auth'
import { getPaddle, PRICE_IDS } from '@/lib/paddle'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}


export function PricingPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'yearly' | null>(null)
  const isMobile = useIsMobile()

  const openCheckout = async (plan: 'monthly' | 'yearly') => {
    if (!user) { navigate({ to: '/login' }); return }
    setLoadingPlan(plan)
    try {
      const paddle = await getPaddle()
      if (!paddle) throw new Error('Paddle failed to load')
      paddle.Checkout.open({
        items: [{ priceId: PRICE_IDS[plan], quantity: 1 }],
        customer: { email: user.email ?? '' },
        customData: { userId: user.id },
        settings: {
          displayMode: 'overlay',
          theme: theme === 'dark' ? 'dark' : 'light',
          successUrl: `${window.location.origin}/dashboard?upgraded=1`,
        },
      })
    } catch (err) {
      console.error('Paddle checkout error', err)
    } finally {
      setLoadingPlan(null)
    }
    void refreshProfile()
  }

  const currentPlan = profile?.plan ?? 'free'

  const plans = [
    {
      name: t('pricing.planFree'), price: '$0', sub: '',
      features: [t('pricing.freeFeat1'), t('pricing.freeFeat2'), t('pricing.freeFeat3'), t('pricing.freeFeat4')],
      cta: currentPlan === 'free' ? t('pricing.currentPlan') : t('pricing.continueFree'),
      featured: false, action: () => navigate({ to: '/' }),
    },
    {
      name: t('pricing.planMonthly'), price: '$9', sub: t('pricing.subMonth'), cancel: t('pricing.cancelAnytime'),
      features: [t('pricing.monthlyFeat1'), t('pricing.monthlyFeat2'), t('pricing.monthlyFeat3'), t('pricing.monthlyFeat4'), t('pricing.monthlyFeat5'), t('pricing.monthlyFeat6')],
      cta: currentPlan === 'monthly' ? t('pricing.currentPlan') : (loadingPlan === 'monthly' ? t('pricing.opening') : t('pricing.startMonthly')),
      featured: true, badge: t('pricing.mostPopular'),
      action: () => { if (currentPlan === 'monthly') return; track.upgradeClicked('pricing_monthly'); openCheckout('monthly') },
    },
    {
      name: t('pricing.planYearly'), price: '$59', sub: t('pricing.subYear'), crossed: '$108', save: t('pricing.save46'),
      features: [t('pricing.yearlyFeat1'), t('pricing.yearlyFeat2'), t('pricing.yearlyFeat3'), t('pricing.yearlyFeat4')],
      cta: currentPlan === 'yearly' ? t('pricing.currentPlan') : (loadingPlan === 'yearly' ? t('pricing.opening') : t('pricing.startYearly')),
      featured: false, badge: t('pricing.bestValue'),
      action: () => { if (currentPlan === 'yearly') return; track.upgradeClicked('pricing_yearly'); openCheckout('yearly') },
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Inter',sans-serif", color: c.textPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '40px 16px 96px' : '72px 24px 48px', position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '70%', height: '45%', background: 'radial-gradient(ellipse, oklch(0.72 0.18 45 / 0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}><CritupLogo size={22} theme={theme} /></div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 10 }}>{t('pricing.eyebrow')}</div>
        <h1 style={{ fontSize: isMobile ? 30 : 38, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>{t('pricing.title')}</h1>
        <p style={{ fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: isMobile ? 32 : 48 }}>{t('pricing.subtitle')}</p>

        <div style={{ display: 'flex', gap: isMobile ? 28 : 20, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          {plans.map(({ name, price, sub, cancel, crossed, save, features, cta, featured, badge, action }) => (
            <div key={name} style={{
              background: c.cardBg, borderRadius: 22, padding: '32px 28px',
              border: featured ? '1.5px solid #F97316' : `1px solid ${c.border}`,
              boxShadow: featured ? '0 0 50px oklch(0.72 0.18 45 / 0.14)' : 'none',
              position: 'relative', width: isMobile ? '100%' : 268, maxWidth: 320,
              transform: featured && !isMobile ? 'scale(1.02)' : 'scale(1)',
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

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => navigate({ to: '/' })} style={{ background: 'none', border: 'none', color: c.textMuted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>{t('pricing.continueWithFree')}</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: c.isDark ? 'oklch(0.45 0.004 270)' : '#9ca3af' }}>
          {t('pricing.questions')} <a href="mailto:hello@critup.ai" style={{ color: '#F97316' }}>hello@critup.ai</a>
        </div>
        <div style={{
          textAlign: 'center', marginTop: 28,
          fontSize: 12, color: c.textMuted,
          borderTop: `1px solid ${c.border}`, paddingTop: 20,
          lineHeight: 1.6,
        }}>
          <Link to="/terms" style={{ color: c.textMuted, textDecoration: 'underline' }}>{t('landing.terms')}</Link>
          <span style={{ margin: '0 8px' }}>·</span>
          <Link to="/privacy" style={{ color: c.textMuted, textDecoration: 'underline' }}>{t('landing.privacy')}</Link>
        </div>
      </div>
    </div>
  )
}
