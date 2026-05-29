import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Users, BarChart2, TrendingUp, Zap, Crown, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useTheme, useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = ['ibro12345@icloud.com']

interface AdminStats {
  users: { total: number; pro: number; free: number; new7d: number; new30d: number }
  analyses: { total: number; last7d: number; last30d: number }
  planBreakdown: Record<string, number>
  disciplineBreakdown: Record<string, number>
  recentAnalyses: Array<{ id: string; created_at: string; projects: { name: string } | null }>
  recentSignups: Array<{ id: string; plan: string; discipline: string | null; created_at: string }>
}

function StatCard({ label, value, sub, icon: Icon, accent, theme, c }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent?: boolean; theme: string
  c: ReturnType<typeof useColors>
}) {
  return (
    <div style={{
      background: c.cardBg, border: accent ? '1.5px solid #F97316' : `1px solid ${c.border}`,
      borderRadius: 16, padding: '20px 22px',
      boxShadow: accent ? '0 0 30px oklch(0.72 0.18 45/0.1)' : 'none',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        <Icon size={16} color={accent ? '#F97316' : c.textMuted} />
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: accent ? '#F97316' : c.textPrimary, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: c.textMuted }}>{sub}</div>}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, width: 140, color: '#9ca3af', flexShrink: 0, textTransform: 'capitalize' }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 100, background: 'oklch(0.22 0.004 270)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 100, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const c = useColors(theme)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = user && ADMIN_EMAILS.includes(user.email ?? '')

  useEffect(() => {
    if (!user) { navigate({ to: '/login' }); return }
    if (!isAdmin) { navigate({ to: '/' }); return }
    fetchStats()
  }, [user])

  async function fetchStats() {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) throw new Error('No session')

      const res = await fetch('/api/admin-stats', {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setStats(data)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (!isAdmin) return null

  const conversionRate = stats
    ? stats.users.total > 0 ? ((stats.users.pro / stats.users.total) * 100).toFixed(1) : '0'
    : '—'

  const maxDisc = stats ? Math.max(...Object.values(stats.disciplineBreakdown), 1) : 1
  const maxPlan = stats ? Math.max(...Object.values(stats.planBreakdown), 1) : 1

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Inter', sans-serif", color: c.textPrimary, maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Admin</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Dashboard</h1>
        </div>
        <button
          onClick={fetchStats}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: `1px solid ${c.border}`,
            color: c.textMuted, borderRadius: 100, padding: '7px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {loading && (
        <div style={{ color: c.textMuted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>Loading stats…</div>
      )}

      {error && (
        <div style={{ color: '#f87171', fontSize: 13, background: 'oklch(0.18 0.02 10)', border: '1px solid oklch(0.3 0.06 10)', borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
          Error: {error}
        </div>
      )}

      {stats && (
        <>
          {/* Top stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total Users"       value={stats.users.total}    sub={`+${stats.users.new7d} this week`}     icon={Users}      theme={theme} c={c} />
            <StatCard label="Pro Subscribers"   value={stats.users.pro}      sub={`${conversionRate}% conversion`}        icon={Crown}      accent theme={theme} c={c} />
            <StatCard label="Free Users"        value={stats.users.free}     sub={`+${stats.users.new30d} this month`}   icon={Users}      theme={theme} c={c} />
            <StatCard label="Total Analyses"    value={stats.analyses.total} sub={`+${stats.analyses.last7d} this week`} icon={BarChart2}  theme={theme} c={c} />
            <StatCard label="Analyses (30d)"    value={stats.analyses.last30d} sub="completed"                           icon={TrendingUp} theme={theme} c={c} />
            <StatCard label="New Users (30d)"   value={stats.users.new30d}   sub="signups"                              icon={Zap}        theme={theme} c={c} />
          </div>

          {/* Breakdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>

            {/* Plan breakdown */}
            <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Plan Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(stats.planBreakdown).sort((a, b) => b[1] - a[1]).map(([plan, count]) => (
                  <BarRow key={plan} label={plan} value={count} max={maxPlan} color={plan === 'free' ? '#6b7280' : '#F97316'} />
                ))}
              </div>
            </div>

            {/* Discipline breakdown */}
            <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Discipline Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(stats.disciplineBreakdown).sort((a, b) => b[1] - a[1]).map(([disc, count]) => (
                  <BarRow key={disc} label={disc.replace(/-/g, ' ')} value={count} max={maxDisc} color='#6366f1' />
                ))}
              </div>
            </div>

          </div>

          {/* Recent activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Recent analyses */}
            <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Recent Analyses</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.recentAnalyses.length === 0 && <span style={{ fontSize: 13, color: c.textMuted }}>No analyses yet</span>}
                {stats.recentAnalyses.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: c.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {a.projects?.name ?? 'Untitled'}
                    </span>
                    <span style={{ fontSize: 11, color: c.textMuted, flexShrink: 0, marginLeft: 8 }}>{formatDate(a.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent signups */}
            <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Recent Signups</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.recentSignups.length === 0 && <span style={{ fontSize: 13, color: c.textMuted }}>No signups yet</span>}
                {stats.recentSignups.map((u) => (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                        background: u.plan !== 'free' ? 'oklch(0.72 0.18 45/0.15)' : c.isDark ? 'oklch(0.22 0.004 270)' : '#f3f4f6',
                        color: u.plan !== 'free' ? '#F97316' : c.textMuted,
                        textTransform: 'uppercase',
                      }}>{u.plan}</span>
                      <span style={{ fontSize: 12, color: c.textMuted, textTransform: 'capitalize' }}>{u.discipline?.replace(/-/g, ' ') ?? '—'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: c.textMuted }}>{formatDate(u.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
