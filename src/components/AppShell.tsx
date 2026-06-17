import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
import {
  LayoutGrid, Folder, CircleDot, Mic, Users, Trophy,
  Settings, HelpCircle, ChevronLeft, ChevronRight,
  Sun, Moon, LogOut, Star, TrendingUp, User, ShieldCheck,
} from 'lucide-react'
import { CritupLogo } from './CritupLogo'
import { AIOrb } from './AIOrb'
import { AIChatPanel } from './AIChatPanel'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'

// `activePath` is what determines the highlighted state — separate from `to`
// so the Analysis item can always highlight on /analysis/* regardless of its `to`.
type NavDef = { to: string; activePath: string; icon: React.ElementType; label: string; disabled?: boolean }

// `label` holds an i18n key (resolved with t() at render time).
const BOTTOM_ITEMS: NavDef[] = [
  { to: '/settings', activePath: '/settings', icon: Settings,   label: 'nav.settings' },
  { to: '/help',     activePath: '/help',     icon: HelpCircle, label: 'nav.help'     },
]

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme()
  const c = useColors(theme)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, user, loading: authLoading, signOut: authSignOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const router = useRouterState()
  const currentPath = router.location.pathname
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Close sidebar on mobile by default
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    if (accountOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [accountOpen])

  // ── Auth guard: redirect to landing if not logged in, onboarding if incomplete ──
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate({ to: '/landing' }); return }
    if (profile && !profile.onboarding_complete) { navigate({ to: '/onboarding' }); return }
  }, [authLoading, user, profile, navigate])

  const signOut = () => {
    setAccountOpen(false)
    authSignOut() // synchronous fire-and-forget — clears localStorage immediately
    navigate({ to: '/landing' })
  }

  // Don't render protected content until auth resolves. Without this, a logged-out
  // visitor (or anyone mid-redirect to /landing or /onboarding) sees the dashboard
  // flash for a frame before the guard effect above navigates away.
  if (authLoading || !user || (profile && !profile.onboarding_complete)) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${c.border}`, borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const isAdmin = user?.email === 'ibro12345@icloud.com'
  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'You'
  const displayInitial = displayName[0].toUpperCase()
  const isPro = profile?.plan !== 'free' || isAdmin  // admin always has pro access
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null

  const sidebarW = sidebarOpen ? 240 : 72

  // Analysis nav points to last visited project; activePath always stays /analysis/
  // so it ONLY highlights on analysis pages (not on /projects fallback).
  // Nav needs the PROJECT id (route param is $projectId). Fall back to the legacy
  // key for older sessions that stored the project id there.
  const lastProjectId = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('critup_last_project_id') ?? localStorage.getItem('critup_last_analysis_id'))
    : null
  const analysisTo = lastProjectId ? `/analysis/${lastProjectId}` : '/projects'
  const NAV_ITEMS: NavDef[] = [
    { to: '/',          activePath: '/',          icon: LayoutGrid,  label: 'nav.dashboard' },
    { to: '/projects',  activePath: '/projects',  icon: Folder,      label: 'nav.projects'  },
    { to: analysisTo,   activePath: '/analysis/', icon: CircleDot,   label: 'nav.analysis'  },
    { to: '/jury',      activePath: '/jury',      icon: Mic,         label: 'nav.jury' },
    { to: '/feed',      activePath: '/feed',      icon: Users,       label: 'nav.feed' },
    { to: '/competitions', activePath: '/competitions', icon: Trophy, label: 'nav.competitions' },
    ...(isAdmin ? [{ to: '/admin', activePath: '/admin', icon: ShieldCheck, label: 'nav.admin' }] : []),
  ]

  // Mobile bottom bar: drop Projects (reachable from dashboard + account menu) and
  // Admin (owner-only, accessible by URL) so the 5 core tabs aren't cramped.
  const MOBILE_NAV_ITEMS = NAV_ITEMS.filter(n => n.activePath !== '/projects' && n.activePath !== '/admin')

  // Use activePath (not `to`) for highlight detection
  const isActive = (activePath: string) => {
    if (activePath === '/') return currentPath === '/'
    return currentPath.startsWith(activePath)
  }

  const pageLabelKey = [...NAV_ITEMS, ...BOTTOM_ITEMS].find(n => isActive(n.activePath))?.label
  const pageLabel = pageLabelKey ? t(pageLabelKey) : 'Critup'

  const NavItem = ({ to, activePath, icon: Icon, label, disabled }: NavDef) => {
    const active = isActive(activePath)
    if (disabled) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, width: '100%',
          padding: sidebarOpen ? '9px 14px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center',
          borderRadius: 9, background: 'transparent',
          color: c.textMuted, opacity: 0.5,
          fontSize: 13, fontWeight: 400, fontFamily: FONT,
          borderLeft: '2.5px solid transparent',
          overflow: 'hidden', whiteSpace: 'nowrap', cursor: 'default',
        }}>
          <span style={{ flexShrink: 0, display: 'flex', marginLeft: sidebarOpen ? 0 : 'auto', marginRight: sidebarOpen ? 0 : 'auto' }}>
            <Icon size={17} color={c.textMuted} strokeWidth={1.6} />
          </span>
          {sidebarOpen && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span>{t(label)}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                background: c.isDark ? 'oklch(0.32 0.004 270)' : '#e5e7eb',
                color: c.textMuted, whiteSpace: 'nowrap', letterSpacing: '0.01em',
              }}>{t('nav.comingSoon')}</span>
            </span>
          )}
        </div>
      )
    }
    return (
      <Link to={to} style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%',
        padding: sidebarOpen ? '9px 14px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center',
        borderRadius: 9, background: active ? c.activeBg : 'transparent',
        color: active ? c.textPrimary : c.textMuted,
        fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: FONT,
        textDecoration: 'none',
        borderLeft: `2.5px solid ${active ? '#F97316' : 'transparent'}`,
        overflow: 'hidden', whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = c.isDark ? 'oklch(0.245 0.004 270)' : '#f3f4f6' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ flexShrink: 0, display: 'flex', marginLeft: sidebarOpen ? 0 : 'auto', marginRight: sidebarOpen ? 0 : 'auto' }}>
          <Icon size={17} color={active ? '#F97316' : c.textMuted} strokeWidth={1.6} />
        </span>
        {sidebarOpen && <span>{t(label)}</span>}
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: c.bg, fontFamily: FONT, overflow: 'hidden' }}>

      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <div style={{
          width: sidebarW, flexShrink: 0, background: c.sidebarBg, borderRight: `1px solid ${c.border}`,
          display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease',
          overflow: 'hidden', position: 'relative', zIndex: 20,
        }}>
          {/* Logo */}
          <div style={{ padding: '16px 14px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center' }}>
            {sidebarOpen
              ? <CritupLogo size={20} showText theme={theme} />
              : <CritupLogo size={22} showText={false} theme={theme} />
            }
            {sidebarOpen && (
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
                <ChevronLeft size={16} color={c.textMuted} />
              </button>
            )}
          </div>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', padding: '8px 0', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              <ChevronRight size={16} color={c.textMuted} />
            </button>
          )}

          <nav style={{ padding: '10px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map(item => <NavItem key={item.to} {...item} />)}
          </nav>

          <div style={{ padding: '8px 8px 0' }}>
            {BOTTOM_ITEMS.map(item => <NavItem key={item.to} {...item} />)}
          </div>

          {sidebarOpen && !isPro && !isAdmin && (
            <div style={{ margin: '10px 10px 8px', padding: '14px', borderRadius: 12, background: c.isDark ? 'oklch(0.225 0.004 270)' : '#fff7ed', border: '1px solid oklch(0.72 0.18 45 / 0.3)', boxShadow: '0 0 16px oklch(0.72 0.18 45 / 0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', marginBottom: 8, letterSpacing: '0.04em', fontFamily: FONT }}>{t('appShell.freePlan')}</div>
              {/* Analyses usage bar */}
              {(() => {
                const used = (profile as { analyses_used?: number } | null)?.analyses_used ?? 0
                const pct = Math.min(100, used * 100)
                return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: c.textMuted, fontFamily: FONT }}>{t('appShell.analyses')}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: used >= 1 ? '#F97316' : c.textMuted, fontFamily: FONT }}>{t('appShell.usedCount', { used })}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 100, background: c.isDark ? 'oklch(0.32 0.004 270)' : '#fde8d0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 100, background: used >= 1 ? '#F97316' : 'oklch(0.72 0.18 45/0.5)', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })()}
              <Link to="/pricing" style={{ display: 'block', width: '100%', padding: '7px 0', borderRadius: 7, background: '#F97316', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 10px oklch(0.72 0.18 45 / 0.35)', textAlign: 'center', textDecoration: 'none', fontFamily: FONT }}>
                {t('appShell.upgradeToPro')}
              </Link>
            </div>
          )}

          <div style={{ padding: '12px 12px 14px', borderTop: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #F97316, oklch(0.65 0.20 35))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: FONT, overflow: 'hidden' }}>
            {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayInitial}
          </div>
            {sidebarOpen && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, whiteSpace: 'nowrap', fontFamily: FONT }}>{profile?.full_name || displayName}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT }}>{isPro ? (profile?.plan ?? 'Pro') : 'Free'}</div>
              </div>
            )}
          </div>

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, background: 'radial-gradient(ellipse 100% 60% at 50% 100%, oklch(0.72 0.18 45 / 0.05), transparent)', pointerEvents: 'none' }} />
        </div>
      )}

      {/* ── Main area ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        transition: 'margin-right 0.25s ease',
        marginRight: (!isMobile && chatOpen) ? 360 : 0,
      }}>
        {/* Header */}
        <div style={{
          height: isMobile ? 52 : 54,
          borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '0 16px' : '0 20px', flexShrink: 0,
          background: c.isDark ? 'oklch(0.21 0.004 270 / 0.95)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          position: 'relative', zIndex: 30,
        }}>
          {/* Left: logo on mobile, page label on desktop */}
          {isMobile
            ? <CritupLogo size={18} showText theme={theme} />
            : <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, letterSpacing: '-0.01em', fontFamily: FONT }}>{pageLabel}</div>
          }

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10 }}>
            {/* Theme toggle */}
            <button onClick={toggle} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
              {theme === 'dark' ? <Sun size={15} color={c.textMuted} /> : <Moon size={15} color={c.textMuted} />}
            </button>

            {/* Animated orb AI button */}
            {!isMobile && <AIOrb size={28} float onClick={() => setChatOpen(o => !o)} active={chatOpen} />}

            {/* Account dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setAccountOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8,
                  padding: isMobile ? '5px 8px 5px 5px' : '5px 10px 5px 6px',
                  borderRadius: 100, background: c.isDark ? 'oklch(0.28 0.004 270)' : '#f3f4f6',
                  border: `1px solid ${c.border}`, cursor: 'pointer',
                }}
              >
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #F97316, oklch(0.65 0.20 35))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: FONT, overflow: 'hidden' }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayInitial}
                </div>
                {!isMobile && <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, fontFamily: FONT }}>{displayName}</span>}
                <ChevronRight size={12} color={c.textMuted} />
              </button>

              {accountOpen && (
                <div style={{
                  position: 'fixed', top: isMobile ? 60 : 62, right: isMobile ? 12 : 20,
                  background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`,
                  padding: '6px', minWidth: 190,
                  boxShadow: c.isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.12)',
                  zIndex: 9999,
                }}>
                  {[
                    { icon: User, label: t('appShell.profile'), to: '/settings' },
                    { icon: TrendingUp, label: t('appShell.myProjects'), to: '/projects' },
                    ...(!isPro ? [{ icon: Star, label: t('appShell.upgradeProMenu'), to: '/pricing', orange: true }] : []),
                    ...(profile?.plan === 'monthly' ? [{ icon: Star, label: t('appShell.upgradeYearlyMenu'), to: '/pricing', orange: true }] : []),
                  ].map(({ icon: Icon, label, to, orange }) => (
                    <Link key={label} to={to} onClick={() => setAccountOpen(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 9,
                      fontSize: 13, fontWeight: 500, fontFamily: FONT,
                      color: orange ? '#F97316' : c.textPrimary,
                      textDecoration: 'none', transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = c.isDark ? 'oklch(0.28 0.004 270)' : '#f3f4f6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <Icon size={15} color={orange ? '#F97316' : c.textMuted} strokeWidth={1.6} />
                      {label}
                    </Link>
                  ))}
                  <div style={{ height: 1, background: c.border, margin: '4px 6px' }} />
                  <button onClick={signOut} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 12px', borderRadius: 9, background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500,
                    fontFamily: FONT, color: 'oklch(0.65 0.18 25)', transition: 'background 0.1s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'oklch(0.65 0.18 25 / 0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <LogOut size={15} color="oklch(0.65 0.18 25)" strokeWidth={1.6} />
                    {t('nav.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content — extra bottom padding on mobile for tab bar */}
        <div style={{ flex: 1, overflow: 'auto', color: c.textPrimary, fontFamily: FONT, paddingBottom: isMobile ? 64 : 0 }}>
          {children}
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          height: 60,
          background: c.isDark ? 'oklch(0.175 0.004 270 / 0.97)' : 'rgba(255,255,255,0.97)',
          borderTop: `1px solid ${c.border}`,
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {MOBILE_NAV_ITEMS.map(({ to, activePath, icon: Icon, label, disabled }) => {
            const active = isActive(activePath)
            if (disabled) {
              return (
                <div key={to} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 3, padding: '6px 0',
                  color: c.textMuted, opacity: 0.5,
                }}>
                  <Icon size={20} color={c.textMuted} strokeWidth={1.6} />
                  <span style={{ fontSize: 8, fontWeight: 500, fontFamily: FONT, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                    {t('nav.comingSoon')}
                  </span>
                </div>
              )
            }
            return (
              <Link key={to} to={to} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '6px 0',
                textDecoration: 'none', color: active ? '#F97316' : c.textMuted,
                transition: 'color 0.15s',
              }}>
                <Icon size={21} color={active ? '#F97316' : c.textMuted} strokeWidth={active ? 2 : 1.6} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, fontFamily: FONT, letterSpacing: '0.005em', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t(label)}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* AI Chat Panel — desktop only */}
      {!isMobile && <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} theme={theme} />}
    </div>
  )
}
