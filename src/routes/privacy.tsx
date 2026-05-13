import { Link } from '@tanstack/react-router'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

export function PrivacyPage() {
  const { theme } = useTheme()
  const c = useColors(theme)

  return (
    <div style={{ background: c.bg, color: c.textPrimary, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 60, borderBottom: `1px solid ${c.border}` }}>
        <Link to="/landing"><CritupLogo size={20} showText theme={theme} /></Link>
        <Link to="/landing" style={{ fontSize: 13, color: c.textMuted, textDecoration: 'none' }}>← Back</Link>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Legal</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.035em', margin: '0 0 8px', fontFamily: FONT }}>Privacy Policy</h1>
        <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 48px' }}>Last updated: May 2026</p>

        {[
          {
            title: 'What we collect',
            body: `When you create an account we collect your email address and any profile information you choose to provide (name, university, discipline). When you upload a project, we store the PDF file and the AI-generated critique results. We also log when you send messages to Crit for rate-limiting purposes.`,
          },
          {
            title: 'How we use your data',
            body: `Your files are used solely to generate your critique. We send your PDF to Anthropic's Claude API for analysis and to ElevenLabs for voice narration. These providers process the data to return results — they do not retain your files. We do not use your project files to train AI models, and we never share your work with other users.`,
          },
          {
            title: 'Your files are private',
            body: `All uploaded PDFs are stored in a private, access-controlled storage bucket. Only you can access your files. Our servers access them temporarily during analysis using a service role key that is never exposed client-side.`,
          },
          {
            title: 'Data retention',
            body: `Your account data is retained until you delete your account. When you delete your account, all associated data — projects, analyses, feedback, and uploaded files — is permanently and irreversibly deleted. Rate-limit logs older than 2 hours are automatically pruned.`,
          },
          {
            title: 'Cookies and analytics',
            body: `We use Plausible Analytics for anonymous, cookieless usage statistics. Plausible does not use cookies, does not track individuals across sites, and is GDPR-compliant by design. No personal data is shared with Plausible.`,
          },
          {
            title: 'Third-party services',
            body: `Critup.ai uses the following third-party services: Supabase (database and file storage, hosted in EU), Anthropic Claude API (AI analysis), ElevenLabs (voice narration), and Vercel (hosting). Each provider has their own privacy policy governing how they handle data.`,
          },
          {
            title: 'Your rights',
            body: `You can export or delete your data at any time from Settings → Account. For any privacy questions or requests, contact us at privacy@critup.ai.`,
          },
        ].map(({ title, body }) => (
          <div key={title} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px', fontFamily: FONT, color: c.textPrimary }}>{title}</h2>
            <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.75, margin: 0 }}>{body}</p>
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 32, fontSize: 13, color: c.textMuted }}>
          Questions? Email <a href="mailto:privacy@critup.ai" style={{ color: '#F97316', textDecoration: 'none' }}>privacy@critup.ai</a>
        </div>
      </div>
    </div>
  )
}
