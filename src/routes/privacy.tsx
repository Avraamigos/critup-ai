import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

const sections = [
  {
    title: '1. Who We Are',
    body: `Critup.ai is operated by Avraam Valikhan and Adil Kamal Batcha ("we", "us", "our"). We are the data controllers responsible for your personal data. Our database is hosted in the European Union (Ireland) and we are committed to GDPR compliance.\n\nContact: hello@critup.ai`,
  },
  {
    title: '2. What We Collect',
    body: `When you create an account: your email address, full name, and any optional profile information you choose to provide (university, discipline, year of study).\n\nWhen you use the Service: PDF files you upload, AI-generated critique results, scores, jury questions, and chat messages you send to Crit. We also store usage counts (number of analyses, chats) for plan enforcement.\n\nAutomatically: anonymised usage analytics via Plausible (cookieless, no personal data). We also temporarily log IP addresses for rate-limiting to prevent abuse — these logs are automatically pruned after 2 hours.`,
  },
  {
    title: '3. How We Use Your Data',
    body: `We use your data solely to provide the Service:\n\n• Your uploaded PDF is sent to the Anthropic Claude API for AI analysis and optionally to ElevenLabs for voice narration. These providers process the data to return results and do not retain your files beyond the duration of the request.\n\n• Your email is used for account authentication and, where you have consented, transactional communications (password resets, subscription updates).\n\n• Usage counts are stored to enforce plan limits (free vs. paid).\n\nWe do NOT use your files or project data to train AI models. We do NOT sell, rent, or share your personal data with third parties for marketing purposes.`,
  },
  {
    title: '4. Legal Basis for Processing (GDPR)',
    body: `For users in the European Economic Area, we process your data on the following legal bases:\n\n• Contract performance (Art. 6(1)(b)): processing your files and account data to provide the Service you signed up for.\n\n• Legitimate interests (Art. 6(1)(f)): IP-based rate limiting to protect the Service from abuse.\n\n• Consent (Art. 6(1)(a)): analytics tracking, where applicable.`,
  },
  {
    title: '5. Your Files Are Private',
    body: `All uploaded PDFs are stored in a private, access-controlled storage bucket on Supabase (EU West — Ireland). Only you can access your files through the Service. Our servers access them temporarily during analysis using a server-side service key that is never exposed to other users or the public internet.`,
  },
  {
    title: '6. Third-Party Services',
    body: `We use the following processors to deliver the Service:\n\n• Supabase — database and file storage (EU West, Ireland). GDPR-compliant.\n• Anthropic — Claude API for AI analysis (US). Subject to Anthropic's data processing agreement.\n• ElevenLabs — voice narration (US). Audio is generated per-request and not stored by us.\n• Vercel — application hosting (US/EU edge). GDPR-compliant.\n• Plausible Analytics — cookieless, privacy-first analytics (EU). No personal data processed.\n• Stripe — payment processing (US). PCI-DSS compliant. We never see or store your card details.\n\nEach provider has their own privacy policy and data processing terms.`,
  },
  {
    title: '7. Data Retention',
    body: `We retain your data for as long as your account is active. When you delete your account, all associated data — profile, projects, analyses, feedback, uploaded files, and chat history — is permanently and irreversibly deleted within 30 days.\n\nYou can delete individual projects at any time from the Projects page. Rate-limit logs are automatically pruned after 2 hours.`,
  },
  {
    title: '8. Your Rights (GDPR)',
    body: `If you are located in the EEA or UK, you have the following rights:\n\n• Right of access — request a copy of the personal data we hold about you.\n• Right to rectification — correct inaccurate data.\n• Right to erasure ("right to be forgotten") — request deletion of your data.\n• Right to restriction — ask us to limit how we use your data.\n• Right to data portability — receive your data in a machine-readable format.\n• Right to object — object to processing based on legitimate interests.\n• Right to withdraw consent — where processing is based on consent, you may withdraw it at any time.\n\nTo exercise any of these rights, email hello@critup.ai. We will respond within 30 days. You also have the right to lodge a complaint with your local data protection authority.`,
  },
  {
    title: '9. Cookies and Analytics',
    body: `We use Plausible Analytics, which is cookieless and does not track individuals across websites. It collects only aggregated, anonymous statistics (page views, referrers, device types). No consent banner is required and no personal data is shared with Plausible.\n\nWe do not use advertising cookies, tracking pixels, or third-party analytics that profile individual users.`,
  },
  {
    title: '10. Security',
    body: `We implement industry-standard security measures including:\n\n• All data transmitted over HTTPS/TLS encryption.\n• Database access controlled via Supabase Row Level Security (RLS) — users can only access their own data.\n• API keys and secrets stored as environment variables, never in client-side code.\n• Private storage buckets with server-side access only.\n\nNo system is 100% secure. In the event of a data breach affecting your personal data, we will notify you and relevant authorities as required by applicable law.`,
  },
  {
    title: '11. International Data Transfers',
    body: `Our database is hosted in the EU (Ireland). Some data is transferred to the United States when processed by Anthropic, ElevenLabs, and Vercel. These transfers are carried out under standard contractual clauses or equivalent safeguards recognised under GDPR.`,
  },
  {
    title: '12. Children',
    body: `Critup.ai is not directed at children under 16. We do not knowingly collect data from anyone under 16. If you believe a minor has created an account, please contact us at hello@critup.ai and we will delete the account promptly.`,
  },
  {
    title: '13. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. Material changes will be communicated by email. The "last updated" date at the top of this page reflects the most recent revision. Continued use of the Service after changes take effect constitutes acceptance.`,
  },
  {
    title: '14. Governing Law',
    body: `This Privacy Policy is governed by the laws of the United Arab Emirates and the Emirate of Dubai, without prejudice to your rights under GDPR or other applicable data protection legislation.`,
  },
  {
    title: '15. Contact',
    body: `For any privacy-related questions, data requests, or to exercise your rights:\n\nEmail: hello@critup.ai\nOperators: Avraam Valikhan & Adil Kamal Batcha — Critup.ai`,
  },
]

export function PrivacyPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const c = useColors(theme)

  return (
    <div style={{ background: c.bg, color: c.textPrimary, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 60, borderBottom: `1px solid ${c.border}` }}>
        <Link to="/landing"><CritupLogo size={20} showText theme={theme} /></Link>
        <Link to="/landing" style={{ fontSize: 13, color: c.textMuted, textDecoration: 'none' }}>{t('legal.back')}</Link>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 80px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{t('legal.eyebrow')}</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.035em', margin: '0 0 8px', fontFamily: FONT }}>{t('legal.privacyTitle')}</h1>
        <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 8px' }}>{t('legal.lastUpdated')}</p>
        <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 48px', lineHeight: 1.6, padding: '14px 16px', background: c.cardBg, borderRadius: 10, border: `1px solid ${c.border}` }}>
          {t('legal.privacyIntro')}
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
