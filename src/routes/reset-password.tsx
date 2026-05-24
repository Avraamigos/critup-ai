import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

// Two modes: "request" (enter email) and "update" (enter new password after clicking email link)
export function ResetPasswordPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [mode, setMode] = useState<'request' | 'update'>('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 9, boxSizing: 'border-box' as const, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb', border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif", transition: 'border 0.15s' }

  // Detect if user arrived via password reset link (hash contains access_token)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setMode('update')
    }
  }, [])

  const requestReset = async () => {
    if (!email || !email.includes('@')) { setError('Valid email required'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  const updatePassword = async () => {
    if (password.length < 6) { setError('At least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate({ to: '/' }), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      <div style={{ position: 'absolute', top: '-10%', right: '5%', width: '50%', height: '60%', background: 'radial-gradient(ellipse, oklch(0.72 0.18 45 / 0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, padding: '44px 40px', background: c.cardBg, borderRadius: 24, border: `1px solid ${c.border}`, position: 'relative', zIndex: 1, boxShadow: c.isDark ? 'none' : '0 8px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}><CritupLogo size={24} theme={theme} /></div>

        {/* Sent state */}
        {sent && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: c.textPrimary, margin: '0 0 10px', fontFamily: FONT }}>Check your email</h1>
            <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6, margin: '0 0 6px' }}>We sent a reset link to</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#F97316', margin: '0 0 24px' }}>{email}</p>
            <button onClick={() => navigate({ to: '/login' })} style={{ color: '#F97316', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>← Back to sign in</button>
          </div>
        )}

        {/* Done state */}
        {done && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: c.textPrimary, margin: '0 0 10px', fontFamily: FONT }}>Password updated!</h1>
            <p style={{ fontSize: 14, color: c.textMuted }}>Redirecting you to the dashboard…</p>
          </div>
        )}

        {/* Request reset form */}
        {!sent && !done && mode === 'request' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px', textAlign: 'center', color: c.textPrimary, fontFamily: FONT }}>Reset password</h1>
            <p style={{ fontSize: 13, color: c.textMuted, textAlign: 'center', margin: '0 0 28px' }}>Enter your email and we'll send you a reset link</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.isDark ? 'oklch(0.75 0.005 270)' : '#6b7280', display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} placeholder="you@university.edu"
                  style={{ ...inp, borderColor: error ? 'oklch(0.65 0.18 25)' : c.border }}
                  onFocus={e => e.target.style.borderColor = '#F97316'}
                  onBlur={e => e.target.style.borderColor = error ? 'oklch(0.65 0.18 25)' : c.border}
                  onKeyDown={e => e.key === 'Enter' && requestReset()}
                />
                {error && <div style={{ fontSize: 12, color: 'oklch(0.65 0.18 25)', marginTop: 4 }}>{error}</div>}
              </div>
              <button onClick={requestReset} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.35)' }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: c.textMuted, marginTop: 22, marginBottom: 0 }}>
              <button onClick={() => navigate({ to: '/login' })} style={{ background: 'none', border: 'none', color: '#F97316', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}>← Back to sign in</button>
            </p>
          </>
        )}

        {/* Update password form */}
        {!done && mode === 'update' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px', textAlign: 'center', color: c.textPrimary, fontFamily: FONT }}>Set new password</h1>
            <p style={{ fontSize: 13, color: c.textMuted, textAlign: 'center', margin: '0 0 28px' }}>Choose a strong password for your account</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'New password', value: password, onChange: setPassword, placeholder: '••••••••' },
                { label: 'Confirm password', value: confirm, onChange: setConfirm, placeholder: '••••••••' },
              ].map(({ label, value, onChange, placeholder }) => (
                <div key={label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.isDark ? 'oklch(0.75 0.005 270)' : '#6b7280', display: 'block', marginBottom: 6 }}>{label}</label>
                  <input type="password" value={value} onChange={e => { onChange(e.target.value); setError('') }} placeholder={placeholder}
                    style={{ ...inp, borderColor: error ? 'oklch(0.65 0.18 25)' : c.border }}
                    onFocus={e => e.target.style.borderColor = '#F97316'}
                    onBlur={e => e.target.style.borderColor = error ? 'oklch(0.65 0.18 25)' : c.border}
                  />
                </div>
              ))}
              {error && <div style={{ fontSize: 12, color: 'oklch(0.65 0.18 25)' }}>{error}</div>}
              <button onClick={updatePassword} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.35)' }}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
