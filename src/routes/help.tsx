import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'

const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5', 'faq6', 'faq7', 'faq8']

const GUIDE_DEFS = [
  { icon: '📐', titleKey: 'help.guide1Title', descKey: 'help.guide1Desc' },
  { icon: '🎯', titleKey: 'help.guide2Title', descKey: 'help.guide2Desc' },
  { icon: '📊', titleKey: 'help.guide3Title', descKey: 'help.guide3Desc' },
  { icon: '🗣️', titleKey: 'help.guide4Title', descKey: 'help.guide4Desc' },
]

export function HelpPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const c = useColors(theme)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const FAQS = FAQ_KEYS.map(k => ({ q: t(`help.${k}q`), a: t(`help.${k}a`) }))
  const GUIDES = GUIDE_DEFS.map(g => ({ icon: g.icon, title: t(g.titleKey), desc: t(g.descKey) }))

  const filtered = FAQS.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 36px', fontFamily: "'Inter',sans-serif", maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: '0 0 4px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{t('help.title')}</h1>
      <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 28px' }}>{t('help.subtitle')}</p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <Search size={15} color={c.textMuted} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('help.searchPlaceholder')}
          style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, boxSizing: 'border-box', background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif" }}
          onFocus={e => e.target.style.borderColor = '#F97316'}
          onBlur={e => e.target.style.borderColor = c.border}
        />
      </div>

      {/* Quick guides */}
      {!search && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, margin: '0 0 14px', letterSpacing: '-0.01em' }}>{t('help.quickGuides')}</h2>
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
          {search ? t('help.results', { count: filtered.length }) : t('help.faqHeading')}
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
            <p style={{ fontSize: 14, color: c.textMuted, textAlign: 'center', padding: '24px 0' }}>{t('help.noResults', { q: search })}</p>
          )}
        </div>
      </div>

      {/* Contact */}
      <div style={{ marginTop: 32, background: c.cardBg, borderRadius: 18, padding: '20px 22px', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, margin: '0 0 3px' }}>{t('help.stillNeedHelp')}</p>
          <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{t('help.respondTime')}</p>
        </div>
        <a href="mailto:hello@critup.ai" style={{ padding: '10px 20px', borderRadius: 100, background: '#F97316', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 16px oklch(0.72 0.18 45 / 0.3)' }}>
          {t('help.emailUs')}
        </a>
      </div>
    </div>
  )
}
