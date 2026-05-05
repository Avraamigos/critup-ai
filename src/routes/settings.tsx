import { useState, useEffect } from 'react'
import { User, Bell, Globe, Shield, Moon, Sun, Check } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Tab = 'profile' | 'notifications' | 'language' | 'account'

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile',       label: 'Profile',          icon: User   },
  { id: 'notifications', label: 'Notifications',    icon: Bell   },
  { id: 'language',      label: 'Language & Region', icon: Globe  },
  { id: 'account',       label: 'Account & Plan',   icon: Shield },
]

const LANGUAGES = [
  { v: 'en', l: 'English',  flag: '🇬🇧' },
  { v: 'ru', l: 'Русский',  flag: '🇷🇺' },
  { v: 'tr', l: 'Türkçe',   flag: '🇹🇷' },
]

export function SettingsPage() {
  const { theme, toggle } = useTheme()
  const c = useColors(theme)
  const { user, profile, refreshProfile } = useAuth()

  const [activeTab, setActiveTab]     = useState<Tab>('profile')
  const [form, setForm]               = useState({ name: '', email: '', university: '' })
  const [saved, setSaved]             = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [language, setLanguage]       = useState('en')
  const [notifications, setNotifications] = useState({
    analysis: true, jury: true, tips: false, updates: true,
  })

  // Populate form from real profile.
  // Use stable primitive deps (id, email, specific fields) instead of object
  // references — prevents double-fire when onAuthStateChange emits a new User
  // object for the same session.
  useEffect(() => {
    if (profile || user) {
      setForm({
        name:       profile?.full_name  || user?.user_metadata?.full_name || '',
        email:      user?.email         || '',
        university: profile?.university || '',
      })
      if (profile?.language) setLanguage(profile.language)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.full_name, profile?.university, profile?.language, user?.id, user?.email])

  const initials = form.name
    ? form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase()

  const inp = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    boxSizing: 'border-box' as const,
    background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb',
    border: `1px solid ${c.border}`, color: c.textPrimary,
    fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif",
  }

  const save = async () => {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    try {
      // Timeout guard: Supabase on free tier can occasionally hang
      const result = await Promise.race([
        supabase.from('profiles').update({ full_name: form.name, university: form.university, language }).eq('id', user.id),
        new Promise<{ error: Error }>(resolve => setTimeout(() => resolve({ error: new Error('Request timed out') }), 8000)),
      ]) as { error: Error | null }
      setSaving(false)
      if (result.error) { setSaveError(result.error.message); return }
      // Don't await refreshProfile — let it update in the background
      refreshProfile().catch(() => {})
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaving(false)
      setSaveError('Save failed. Please try again.')
    }
  }

  const Toggle = ({ val, onChange }: { val: boolean; onChange: () => void }) => (
    <button onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer',
      transition: 'all 0.2s',
      background: val ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#d1d5db'),
      position: 'relative',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: val ? 23 : 3,
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )

  return (
    <div style={{ padding: '32px 36px', fontFamily: "'Inter',sans-serif", maxWidth: 800 }}>
      <h1 style={{
        fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary,
        margin: '0 0 28px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif",
      }}>Settings</h1>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Sidebar tabs */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10,
                background: activeTab === id ? (c.isDark ? 'oklch(0.28 0.006 270)' : '#fff7ed') : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                color: activeTab === id ? c.textPrimary : c.textMuted,
              }}>
                <Icon size={15} color={activeTab === id ? '#F97316' : c.textMuted} />
                <span style={{ fontSize: 13, fontWeight: activeTab === id ? 600 : 400 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, padding: '24px' }}>

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>Profile</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${c.border}` }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {initials}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 2px' }}>{form.name || 'Your name'}</p>
                  <p style={{ fontSize: 12, color: c.textMuted, margin: '0 0 8px' }}>{form.email}</p>
                  <button style={{ fontSize: 12, color: '#F97316', background: 'none', border: `1px solid #F97316`, borderRadius: 100, padding: '4px 12px', cursor: 'pointer' }}>Change photo</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  { label: 'Full name',   key: 'name'       as const, editable: true  },
                  { label: 'Email',       key: 'email'      as const, editable: false },
                  { label: 'University',  key: 'university' as const, editable: true  },
                ] as { label: string; key: 'name' | 'email' | 'university'; editable: boolean }[]).map(({ label, key, editable }) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, display: 'block', marginBottom: 6 }}>{label}</label>
                    <input
                      value={form[key]}
                      onChange={e => editable && setForm(f => ({ ...f, [key]: e.target.value }))}
                      readOnly={!editable}
                      style={{ ...inp, opacity: editable ? 1 : 0.6, cursor: editable ? 'text' : 'default' }}
                      onFocus={e => { if (editable) e.target.style.borderColor = '#F97316' }}
                      onBlur={e => e.target.style.borderColor = c.border}
                    />
                    {!editable && <p style={{ fontSize: 11, color: c.textMuted, margin: '4px 0 0' }}>Email can't be changed here</p>}
                  </div>
                ))}

                {/* Theme toggle */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, display: 'block', marginBottom: 6 }}>Appearance</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['dark', 'light'] as const).map(t => (
                      <button key={t} onClick={() => { if (theme !== t) toggle() }} style={{
                        flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                        background: theme === t ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.1)' : '#fff7ed') : c.isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb',
                        border: theme === t ? '1.5px solid #F97316' : `1px solid ${c.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        color: theme === t ? '#F97316' : c.textMuted, fontSize: 13, fontWeight: 600,
                      }}>
                        {t === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                        {t === 'dark' ? 'Dark' : 'Light'}
                      </button>
                    ))}
                  </div>
                </div>

                {saveError && <p style={{ fontSize: 13, color: 'oklch(0.65 0.18 25)', margin: 0 }}>{saveError}</p>}

                <button onClick={save} disabled={saving} style={{
                  padding: '11px', borderRadius: 100, background: '#F97316', border: 'none',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.3)', transition: 'all 0.2s', marginTop: 4,
                }}>
                  {saved ? <><Check size={15} /> Saved!</> : saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === 'notifications' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>Notifications</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {([
                  { key: 'analysis' as const, label: 'Analysis complete',        desc: 'When your project analysis is ready'      },
                  { key: 'jury'     as const, label: 'Jury practice reminders',  desc: 'Daily reminders to practise before jury'  },
                  { key: 'tips'     as const, label: 'Weekly tips',              desc: 'Design and presentation tips from the AI' },
                  { key: 'updates'  as const, label: 'Product updates',          desc: 'New features and improvements'            },
                ]).map(({ key, label, desc }, i, arr) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: i < arr.length - 1 ? `1px solid ${c.border}` : 'none' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 2px' }}>{label}</p>
                      <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>{desc}</p>
                    </div>
                    <Toggle val={notifications[key]} onChange={() => setNotifications(n => ({ ...n, [key]: !n[key] }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Language ── */}
          {activeTab === 'language' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>Language & Region</h2>
              <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 16 }}>The AI will respond and critique in your selected language</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LANGUAGES.map(l => (
                  <button key={l.v} onClick={() => setLanguage(l.v)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    background: language === l.v ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.1)' : '#fff7ed') : c.isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb',
                    border: language === l.v ? '1.5px solid #F97316' : `1px solid ${c.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{l.flag}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: language === l.v ? '#F97316' : c.textPrimary }}>{l.l}</span>
                    </div>
                    {language === l.v && <Check size={15} color="#F97316" />}
                  </button>
                ))}
              </div>
              <button onClick={save} disabled={saving} style={{
                marginTop: 20, padding: '11px 24px', borderRadius: 100, background: '#F97316',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1, boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.3)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {saved ? <><Check size={15} /> Saved!</> : 'Save language'}
              </button>
            </div>
          )}

          {/* ── Account & Plan ── */}
          {activeTab === 'account' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>Account & Plan</h2>
              <div style={{ background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc', borderRadius: 14, padding: '16px', border: `1px solid ${c.border}`, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 4 }}>CURRENT PLAN</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, textTransform: 'capitalize' }}>{profile?.plan ?? 'Free'}</div>
                    <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>{profile?.analyses_used ?? 0} analyses used</div>
                  </div>
                  <button style={{ padding: '10px 18px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px oklch(0.72 0.18 45 / 0.3)' }}>
                    Upgrade →
                  </button>
                </div>
              </div>
              <div style={{ borderRadius: 14, padding: '16px', border: `1px solid oklch(0.65 0.18 25 / 0.3)` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.65 0.18 25)', marginBottom: 10 }}>Danger zone</div>
                <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 12px' }}>These actions are permanent and cannot be undone.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ padding: '8px 14px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, cursor: 'pointer' }}>Export data</button>
                  <button style={{ padding: '8px 14px', borderRadius: 100, background: 'transparent', border: `1px solid oklch(0.65 0.18 25 / 0.4)`, color: 'oklch(0.65 0.18 25)', fontSize: 13, cursor: 'pointer' }}>Delete account</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
