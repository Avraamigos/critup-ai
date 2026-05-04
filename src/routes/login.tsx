import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export function LoginPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 9, boxSizing: 'border-box' as const, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb', border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif", transition: 'border 0.15s' }

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!email || !email.includes('@')) e.email = 'Valid email required'
    if (!password) e.password = 'Password is required'
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setErrors({ password: error }); return }
    // Full page reload ensures auth state is fully hydrated before AppShell renders,
    // preventing the race-condition redirect back to /landing.
    window.location.href = '/'
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      <div style={{ position: 'absolute', top: '-10%', right: '5%', width: '50%', height: '60%', background: 'radial-gradient(ellipse, oklch(0.72 0.18 45 / 0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 420, padding: '44px 40px', background: c.cardBg, borderRadius: 24, border: `1px solid ${c.border}`, position: 'relative', zIndex: 1, boxShadow: c.isDark ? 'none' : '0 8px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}><CritupLogo size={24} theme={theme} /></div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px', textAlign: 'center', color: c.textPrimary, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>Welcome back</h1>
        <p style={{ fontSize: 13, color: c.textMuted, textAlign: 'center', margin: '0 0 28px' }}>Sign in to your account</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.isDark ? 'oklch(0.75 0.005 270)' : '#6b7280', display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: '' })) }} placeholder="you@university.edu"
              style={{ ...inp, borderColor: errors.email ? 'oklch(0.65 0.18 25)' : c.border }}
              onFocus={e => e.target.style.borderColor = errors.email ? 'oklch(0.65 0.18 25)' : '#F97316'}
              onBlur={e => e.target.style.borderColor = errors.email ? 'oklch(0.65 0.18 25)' : c.border}
            />
            {errors.email && <div style={{ fontSize: 12, color: 'oklch(0.65 0.18 25)', marginTop: 4 }}>{errors.email}</div>}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.isDark ? 'oklch(0.75 0.005 270)' : '#6b7280' }}>Password</label>
              <a href="#" style={{ fontSize: 12, color: '#F97316', textDecoration: 'none' }}>Forgot?</a>
            </div>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: '' })) }} placeholder="••••••••"
              style={{ ...inp, borderColor: errors.password ? 'oklch(0.65 0.18 25)' : c.border }}
              onFocus={e => e.target.style.borderColor = '#F97316'}
              onBlur={e => e.target.style.borderColor = c.border}
            />
            {errors.password && <div style={{ fontSize: 12, color: 'oklch(0.65 0.18 25)', marginTop: 4 }}>{errors.password}</div>}
          </div>
          <button onClick={submit} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.35)', marginTop: 4 }}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: c.border }} /><span style={{ fontSize: 12, color: c.textMuted }}>or</span><div style={{ flex: 1, height: 1, background: c.border }} />
        </div>
        <button onClick={signInWithGoogle} style={{ width: '100%', padding: '11px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <GoogleIcon /> Continue with Google
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: c.textMuted, marginTop: 22, marginBottom: 0 }}>
          No account? <Link to="/signup" style={{ background: 'none', border: 'none', color: '#F97316', cursor: 'pointer', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}
