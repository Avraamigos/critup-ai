import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

export function TermsPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const c = useColors(theme)
  const sections = t('legal.termsSections', { returnObjects: true }) as { title: string; body: string }[]

  return (
    <div style={{ background: c.bg, color: c.textPrimary, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 60, borderBottom: `1px solid ${c.border}` }}>
        <Link to="/landing"><CritupLogo size={20} showText theme={theme} /></Link>
        <Link to="/landing" style={{ fontSize: 13, color: c.textMuted, textDecoration: 'none' }}>{t('legal.back')}</Link>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 80px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{t('legal.eyebrow')}</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.035em', margin: '0 0 8px', fontFamily: FONT }}>{t('legal.termsTitle')}</h1>
        <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 8px' }}>{t('legal.lastUpdated')}</p>
        <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 48px', lineHeight: 1.6, padding: '14px 16px', background: c.cardBg, borderRadius: 10, border: `1px solid ${c.border}` }}>
          {t('legal.termsIntro')}
        </p>

        {sections.map(({ title, body }) => (
          <div key={title} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px', fontFamily: FONT, color: c.textPrimary }}>{title}</h2>
            {body.split('\n\n').map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.75, margin: i < body.split('\n\n').length - 1 ? '0 0 12px' : '0' }}>{para}</p>
            ))}
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 32, fontSize: 13, color: c.textMuted }}>
          {t('legal.questionsEmail')} <a href="mailto:hello@critup.ai" style={{ color: '#F97316', textDecoration: 'none' }}>hello@critup.ai</a>
        </div>
      </div>
    </div>
  )
}
