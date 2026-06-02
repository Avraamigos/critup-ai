import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Bell, Globe, Shield, Moon, Sun, Check, AlertTriangle, Loader2, Eye, EyeOff, Camera } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import i18n from '@/lib/i18n'
import { useNavigate } from '@tanstack/react-router'

type Tab = 'profile' | 'notifications' | 'language' | 'account'

const TABS: { id: Tab; labelKey: string; icon: typeof User }[] = [
  { id: 'profile',       labelKey: 'settings.tabProfile',       icon: User   },
  { id: 'notifications', labelKey: 'settings.tabNotifications', icon: Bell   },
  { id: 'language',      labelKey: 'settings.tabLanguage',      icon: Globe  },
  { id: 'account',       labelKey: 'settings.tabAccount',       icon: Shield },
]

const LANGUAGES = [
  { v: 'en', l: 'English',  flag: '🇬🇧' },
  { v: 'ru', l: 'Русский',  flag: '🇷🇺' },
  { v: 'tr', l: 'Türkçe',   flag: '🇹🇷' },
]

export function SettingsPage() {
  const { theme, toggle } = useTheme()
  const c = useColors(theme)
  const { t } = useTranslation()
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]     = useState<Tab>('profile')
  const [form, setForm]               = useState({ name: '', email: '', university: '' })
  const [saved, setSaved]             = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [language, setLanguage]       = useState('en')
  const [notifications, setNotifications] = useState({
    analysis: true, jury: true, updates: true,
  })
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')

  // Change photo
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Change password
  const [pwForm, setPwForm]           = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError]         = useState<string | null>(null)
  const [pwSaving, setPwSaving]       = useState(false)
  const [pwSaved, setPwSaved]         = useState(false)
  const [showPw, setShowPw]           = useState({ current: false, next: false, confirm: false })

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm]     = useState('')
  const [deleting, setDeleting]               = useState(false)
  const [deleteError, setDeleteError]         = useState<string | null>(null)

  // Init notification permission state
  useEffect(() => {
    if (!('Notification' in window)) { setNotifPermission('unsupported'); return }
    setNotifPermission(Notification.permission)
  }, [])

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE' || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error(t('settings.notAuthenticated'))
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Delete failed')
      }
      await signOut()
      navigate({ to: '/landing' })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('settings.deleteGeneric'))
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (profile || user) {
      setForm({
        name:       profile?.full_name  || user?.user_metadata?.full_name || '',
        email:      user?.email         || '',
        university: profile?.university || '',
      })
      if (profile?.language) setLanguage(profile.language)
      // Load avatar from user metadata
      const meta = user?.user_metadata
      if (meta?.avatar_url) setAvatarUrl(meta.avatar_url as string)
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
      const result = await Promise.race([
        supabase.from('profiles').update({ full_name: form.name, university: form.university, language }).eq('id', user.id),
        new Promise<{ error: Error }>(resolve => setTimeout(() => resolve({ error: new Error(t('settings.requestTimedOut')) }), 8000)),
      ]) as { error: Error | null }
      setSaving(false)
      if (result.error) { setSaveError(result.error.message); return }
      // Switch the UI language immediately to match the saved preference.
      if (i18n.language !== language) i18n.changeLanguage(language)
      refreshProfile().catch(() => {})
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaving(false)
      setSaveError(t('settings.saveFailed'))
    }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setPhotoUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = urlData.publicUrl
      await supabase.auth.updateUser({ data: { avatar_url: url } })
      setAvatarUrl(url)
    } catch {
      // Avatar bucket might not be set up — silently fail
    } finally {
      setPhotoUploading(false)
    }
  }

  const changePassword = async () => {
    if (pwForm.next.length < 6) { setPwError(t('settings.passwordTooShort')); return }
    if (pwForm.next !== pwForm.confirm) { setPwError(t('settings.passwordsNoMatch')); return }
    setPwSaving(true); setPwError(null)
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwSaved(true)
    setPwForm({ current: '', next: '', confirm: '' })
    setTimeout(() => setPwSaved(false), 3000)
  }

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

  const exportData = async () => {
    if (!user) return
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const { data: analyses } = await supabase.from('analyses').select('id, status, concept_score, spatial_score, presentation_score, created_at').eq('user_id', user.id)
    const { data: projects } = await supabase.from('projects').select('id, name, stage, created_at').eq('user_id', user.id)
    const blob = new Blob([JSON.stringify({ profile: profileData, projects, analyses }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'critup-data.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const Toggle = ({ val, onChange }: { val: boolean; onChange: () => void }) => (
    <button onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer',
      transition: 'all 0.2s',
      background: val ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#d1d5db'),
      position: 'relative', flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: val ? 23 : 3,
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )

  return (
    <>
    <div style={{ padding: '32px 36px', fontFamily: "'Inter',sans-serif", maxWidth: 800 }}>
      <h1 style={{
        fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary,
        margin: '0 0 28px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif",
      }}>{t('settings.title')}</h1>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Sidebar tabs */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(({ id, labelKey, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10,
                background: activeTab === id ? (c.isDark ? 'oklch(0.28 0.006 270)' : '#fff7ed') : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                color: activeTab === id ? c.textPrimary : c.textMuted,
              }}>
                <Icon size={15} color={activeTab === id ? '#F97316' : c.textMuted} />
                <span style={{ fontSize: 13, fontWeight: activeTab === id ? 600 : 400 }}>{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, padding: '24px' }}>

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>{t('settings.profileHeading')}</h2>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${c.border}` }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarUrl ? 'transparent' : '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', overflow: 'hidden' }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials
                    }
                  </div>
                  {photoUploading && (
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={16} color="#fff" style={{ animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 2px' }}>{form.name || t('settings.yourName')}</p>
                  <p style={{ fontSize: 12, color: c.textMuted, margin: '0 0 8px' }}>{form.email}</p>
                  <button onClick={() => photoInputRef.current?.click()} style={{ fontSize: 12, color: '#F97316', background: 'none', border: '1px solid #F97316', borderRadius: 100, padding: '4px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Camera size={11} /> {t('settings.changePhoto')}
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </div>
              </div>

              {/* Profile fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  { label: t('settings.fullName'),   key: 'name'       as const, editable: true  },
                  { label: t('settings.email'),      key: 'email'      as const, editable: false },
                  { label: t('settings.university'), key: 'university' as const, editable: true  },
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
                    {!editable && <p style={{ fontSize: 11, color: c.textMuted, margin: '4px 0 0' }}>{t('settings.emailReadonly')}</p>}
                  </div>
                ))}

                {/* Theme toggle */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, display: 'block', marginBottom: 6 }}>{t('settings.appearance')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['dark', 'light'] as const).map(th => (
                      <button key={th} onClick={() => { if (theme !== th) toggle() }} style={{
                        flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                        background: theme === th ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.1)' : '#fff7ed') : c.isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb',
                        border: theme === th ? '1.5px solid #F97316' : `1px solid ${c.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        color: theme === th ? '#F97316' : c.textMuted, fontSize: 13, fontWeight: 600,
                      }}>
                        {th === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                        {th === 'dark' ? t('settings.dark') : t('settings.light')}
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
                  {saved ? <><Check size={15} /> {t('common.saved')}</> : saving ? t('common.saving') : t('settings.saveChanges')}
                </button>
              </div>

              {/* ── Change Password ── */}
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${c.border}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, margin: '0 0 14px' }}>{t('settings.changePassword')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    { key: 'next'    as const, label: t('settings.newPassword')     },
                    { key: 'confirm' as const, label: t('settings.confirmPassword') },
                  ]).map(({ key, label }) => (
                    <div key={key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, display: 'block', marginBottom: 6 }}>{label}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPw[key] ? 'text' : 'password'}
                          value={pwForm[key]}
                          onChange={e => { setPwForm(f => ({ ...f, [key]: e.target.value })); setPwError(null) }}
                          placeholder="••••••••"
                          style={{ ...inp, paddingRight: 40 }}
                          onFocus={e => e.target.style.borderColor = '#F97316'}
                          onBlur={e => e.target.style.borderColor = c.border}
                        />
                        <button onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0, display: 'flex' }}>
                          {showPw[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {pwError && <p style={{ fontSize: 12, color: 'oklch(0.65 0.18 25)', margin: 0 }}>{pwError}</p>}
                  {pwSaved && <p style={{ fontSize: 12, color: '#1a9e4a', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}><Check size={12} /> {t('settings.passwordUpdated')}</p>}
                  <button onClick={changePassword} disabled={pwSaving || !pwForm.next || !pwForm.confirm} style={{
                    padding: '10px', borderRadius: 100, background: c.isDark ? 'oklch(0.28 0.006 270)' : '#f3f4f6',
                    border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontWeight: 600,
                    cursor: pwSaving ? 'not-allowed' : 'pointer', opacity: (!pwForm.next || !pwForm.confirm) ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {pwSaving ? t('settings.updatingPassword') : t('settings.updatePassword')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === 'notifications' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>{t('settings.notificationsHeading')}</h2>

              {/* Browser permission banner */}
              {notifPermission !== 'unsupported' && notifPermission !== 'granted' && (
                <div style={{ background: c.isDark ? 'oklch(0.72 0.18 45 / 0.08)' : '#fff7ed', border: '1px solid oklch(0.72 0.18 45 / 0.3)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, margin: '0 0 2px' }}>{t('settings.enableDesktop')}</p>
                    <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>{notifPermission === 'denied' ? t('settings.notifBlocked') : t('settings.notifReady')}</p>
                  </div>
                  {notifPermission !== 'denied' && (
                    <button onClick={requestNotifPermission} style={{ padding: '8px 16px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 0 12px oklch(0.72 0.18 45 / 0.3)' }}>
                      {t('settings.allow')}
                    </button>
                  )}
                </div>
              )}
              {notifPermission === 'granted' && (
                <div style={{ background: c.isDark ? 'oklch(0.72 0.18 45 / 0.06)' : '#f0fdf4', border: '1px solid oklch(0.55 0.15 145 / 0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={14} color="#1a9e4a" />
                  <p style={{ fontSize: 13, color: '#1a9e4a', margin: 0, fontWeight: 500 }}>{t('settings.notifEnabled')}</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {([
                  { key: 'analysis' as const, label: t('settings.notifAnalysis'), desc: t('settings.notifAnalysisDesc') },
                  { key: 'jury'     as const, label: t('settings.notifJury'),     desc: t('settings.notifJuryDesc')     },
                  { key: 'updates'  as const, label: t('settings.notifUpdates'),  desc: t('settings.notifUpdatesDesc')  },
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
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>{t('settings.languageHeading')}</h2>
              <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 16 }}>{t('settings.languageSubtitle')}</p>
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
                {saved ? <><Check size={15} /> {t('common.saved')}</> : t('settings.saveLanguage')}
              </button>
            </div>
          )}

          {/* ── Account & Plan ── */}
          {activeTab === 'account' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 20px' }}>{t('settings.accountHeading')}</h2>

              {/* Plan card */}
              <div style={{ background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc', borderRadius: 14, padding: '18px', border: `1px solid ${c.border}`, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 6 }}>{t('settings.currentPlan')}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, textTransform: 'capitalize', letterSpacing: '-0.02em' }}>{profile?.plan === 'free' || !profile?.plan ? t('common.free') : profile.plan}</div>
                    <div style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>{t('settings.analysesUsed', { count: profile?.analyses_used ?? 0 })} · {profile?.plan === 'free' || !profile?.plan ? t('settings.includedFree') : t('settings.fullAccess')}</div>
                  </div>
                  <button
                    onClick={() => navigate({ to: '/pricing' })}
                    style={{ padding: '10px 20px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.35)', whiteSpace: 'nowrap' }}
                  >
                    {t('settings.upgradeArrow')}
                  </button>
                </div>
              </div>

              {/* Danger zone */}
              <div style={{ borderRadius: 14, padding: '16px', border: '1px solid oklch(0.65 0.18 25 / 0.3)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.65 0.18 25)', marginBottom: 6 }}>{t('settings.dangerZone')}</div>
                <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 12px' }}>{t('settings.dangerDesc')}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={exportData} style={{ padding: '8px 14px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, cursor: 'pointer' }}>{t('settings.exportData')}</button>
                  <button onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); setDeleteError(null) }} style={{ padding: '8px 14px', borderRadius: 100, background: 'transparent', border: '1px solid oklch(0.65 0.18 25 / 0.4)', color: 'oklch(0.65 0.18 25)', fontSize: 13, cursor: 'pointer' }}>{t('settings.deleteAccount')}</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>

    {/* ── Delete account modal ── */}
    {showDeleteModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget && !deleting) setShowDeleteModal(false) }}>
        <div style={{ background: c.bg, borderRadius: 20, padding: '28px', width: '100%', maxWidth: 420, border: '1px solid oklch(0.65 0.18 25 / 0.4)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'oklch(0.65 0.18 25 / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={17} color="oklch(0.65 0.18 25)" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: c.textPrimary, margin: 0 }}>{t('settings.deleteHeading')}</h2>
          </div>
          <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.65, margin: '0 0 16px' }}>
            {t('settings.deleteBody')} <strong style={{ color: c.textPrimary }}>{t('settings.deleteCannotUndo')}</strong>
          </p>
          <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 8px' }}>{t('settings.typeToConfirm', { word: 'DELETE' })}</p>
          <input
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            disabled={deleting}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, background: c.cardBg, border: `1.5px solid ${deleteConfirm === 'DELETE' ? 'oklch(0.65 0.18 25)' : c.border}`, color: c.textPrimary, fontSize: 14, outline: 'none', fontFamily: 'monospace', marginBottom: 16 }}
          />
          {deleteError && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'oklch(0.65 0.18 25/0.08)', border: '1px solid oklch(0.65 0.18 25/0.3)', fontSize: 13, color: 'oklch(0.65 0.18 25)', marginBottom: 14 }}>
              {deleteError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowDeleteModal(false)} disabled={deleting} style={{ padding: '9px 20px', borderRadius: 100, background: 'none', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, cursor: 'pointer' }}>{t('common.cancel')}</button>
            <button onClick={handleDeleteAccount} disabled={deleteConfirm !== 'DELETE' || deleting}
              style={{ padding: '9px 20px', borderRadius: 100, background: deleteConfirm === 'DELETE' && !deleting ? 'oklch(0.65 0.18 25)' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'), border: 'none', color: deleteConfirm === 'DELETE' && !deleting ? '#fff' : c.textMuted, fontSize: 13, fontWeight: 600, cursor: deleteConfirm === 'DELETE' && !deleting ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
              {deleting && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {deleting ? t('settings.deleting') : t('settings.deleteMyAccount')}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )}
    </>
  )
}
