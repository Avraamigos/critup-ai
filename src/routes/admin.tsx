import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Users, BarChart2, TrendingUp, Zap, Crown, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useTheme, useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = ['ibro12345@icloud.com']

interface AdminStats {
  users: { total: number; pro: number; free: number; new7d: number; new30d: number }
  analyses: { total: number; failed: number; last7d: number; last30d: number }
  planBreakdown: Record<string, number>
  disciplineBreakdown: Record<string, number>
  recentAnalyses: Array<{
    id: string; created_at: string; avg_score: string | null
    projects: { name: string } | null; email: string | null
    concept_score: number | null; spatial_score: number | null; presentation_score: number | null
  }>
  recentSignups: Array<{
    id: string; plan: string; discipline: string | null
    full_name: string | null; email: string | null; created_at: string
  }>
}

type Tab = 'overview' | 'users' | 'analyses'

function StatCard({ label, value, sub, icon: Icon, accent, warn, c }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent?: boolean; warn?: boolean
  c: ReturnType<typeof useColors>
}) {
  const color = accent ? '#F97316' : warn ? '#f87171' : c.textPrimary
  const border = accent ? '1.5px solid #F97316' : warn ? '1.5px solid #f87171' : `1px solid ${c.border}`
  return (
    <div style={{ background: c.cardBg, border, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
        <Icon size={15} color={accent ? '#F97316' : warn ? '#f87171' : c.textMuted} />
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: c.textMuted }}>{sub}</div>}
    </div>
  )
}

function BarRow({ label, value, max, color, c }: { label: string; value: number; max: number; color: string; c: ReturnType<typeof useColors> }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, width: 160, color: c.textMuted, flexShrink: 0, textTransform: 'capitalize' }}>{label.replace(/-/g, ' ')}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 100, background: c.isDark ? 'oklch(0.26 0.004 270)' : '#e5e7eb', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 100, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary, width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function PlanBadge({ plan, c }: { plan: string; c: ReturnType<typeof useColors> }) {
  const isPro = plan !== 'free'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
      background: isPro ? 'oklch(0.72 0.18 45/0.15)' : c.isDark ? 'oklch(0.26 0.004 270)' : '#f3f4f6',
      color: isPro ? '#F97316' : c.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>{plan}</span>
  )
}

function ScorePill({ score }: { score: string | null }) {
  if (!score) return <span style={{ fontSize: 12, color: '#6b7280' }}>—</span>
  const n = parseFloat(score)
  const color = n >= 7.5 ? '#22c55e' : n >= 5 ? '#F97316' : '#f87171'
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}</span>
  )
}

const TH = ({ children, c }: { children: string; c: ReturnType<typeof useColors> }) => (
  <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${c.border}` }}>
    {children}
  </th>
)

export function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const c = useColors(theme)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  const isAdmin = user && ADMIN_EMAILS.includes(user.email ?? '')

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate({ to: '/login' }); return }
    if (!isAdmin) { navigate({ to: '/' }); return }
    fetchStats()
  }, [user, authLoading])

  async function fetchStats() {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) throw new Error('No session')
      const res = await fetch('/api/admin-stats', { headers: { Authorization: `Bearer ${jwt}` } })
      if (!res.ok) throw new Error(await res.text())
      setStats(await res.json())
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (authLoading) return null
  if (!isAdmin) return null

  const conversionRate = stats?.users.total
    ? ((stats.users.pro / stats.users.total) * 100).toFixed(1)
    : '0'

  const errorRate = stats
    ? stats.analyses.total + stats.analyses.failed > 0
      ? ((stats.analyses.failed / (stats.analyses.total + stats.analyses.failed)) * 100).toFixed(1)
      : '0'
    : '0'

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users',    label: `Users${stats ? ` (${stats.users.total})` : ''}` },
    { id: 'analyses', label: `Analyses${stats ? ` (${stats.analyses.total})` : ''}` },
  ]

  const rowStyle = (i: number, total: number) => ({
    borderBottom: i < total - 1 ? `1px solid ${c.border}` : 'none',
    transition: 'background 0.1s',
  })

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'Inter', sans-serif", color: c.textPrimary, maxWidth: 1020, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color="#F97316" />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Admin</h1>
        </div>
        <button onClick={fetchStats} disabled={refreshing} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: `1px solid ${c.border}`,
          color: c.textMuted, borderRadius: 100, padding: '6px 14px',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 22, borderBottom: `1px solid ${c.border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? '#F97316' : c.textMuted,
            borderBottom: `2px solid ${tab === t.id ? '#F97316' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ color: c.textMuted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>Loading…</div>}
      {error && (
        <div style={{ color: '#f87171', fontSize: 13, background: 'oklch(0.18 0.02 10 / 0.5)', border: '1px solid oklch(0.3 0.06 10)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {!loading && stats && tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
            <StatCard label="Total Users"      value={stats.users.total}      sub={`+${stats.users.new7d} this week`}     icon={Users}         c={c} />
            <StatCard label="Pro Subscribers"  value={stats.users.pro}        sub={`${conversionRate}% conversion`}        icon={Crown}   accent c={c} />
            <StatCard label="Free Users"       value={stats.users.free}       sub={`+${stats.users.new30d} this month`}   icon={Users}         c={c} />
            <StatCard label="Total Analyses"   value={stats.analyses.total}   sub={`+${stats.analyses.last7d} this week`} icon={BarChart2}      c={c} />
            <StatCard label="Analyses (30d)"   value={stats.analyses.last30d} sub="completed"                             icon={TrendingUp}     c={c} />
            <StatCard label="Failed Analyses"  value={stats.analyses.failed}  sub={`${errorRate}% error rate`}            icon={AlertTriangle} warn={stats.analyses.failed > 0} c={c} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Plan Split</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(stats.planBreakdown).sort((a, b) => b[1] - a[1]).map(([plan, count]) => (
                  <BarRow key={plan} label={plan} value={count} max={Math.max(...Object.values(stats.planBreakdown), 1)} color={plan === 'free' ? '#6b7280' : '#F97316'} c={c} />
                ))}
              </div>
            </div>
            <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Disciplines</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(stats.disciplineBreakdown).sort((a, b) => b[1] - a[1]).map(([disc, count]) => (
                  <BarRow key={disc} label={disc} value={count} max={Math.max(...Object.values(stats.disciplineBreakdown), 1)} color="#6366f1" c={c} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── USERS ── */}
      {!loading && stats && tab === 'users' && (
        <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH c={c}>Email</TH>
                <TH c={c}>Name</TH>
                <TH c={c}>Plan</TH>
                <TH c={c}>Discipline</TH>
                <TH c={c}>Signed up</TH>
              </tr>
            </thead>
            <tbody>
              {stats.recentSignups.map((u, i) => (
                <tr key={u.id} style={rowStyle(i, stats.recentSignups.length)}>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: c.textPrimary, fontWeight: 500 }}>{u.email ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: c.textMuted }}>{u.full_name ?? '—'}</td>
                  <td style={{ padding: '11px 16px' }}><PlanBadge plan={u.plan} c={c} /></td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: c.textMuted, textTransform: 'capitalize' }}>{u.discipline?.replace(/-/g, ' ') ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ANALYSES ── */}
      {!loading && stats && tab === 'analyses' && (
        <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH c={c}>Project</TH>
                <TH c={c}>User</TH>
                <TH c={c}>Avg</TH>
                <TH c={c}>C</TH>
                <TH c={c}>S</TH>
                <TH c={c}>P</TH>
                <TH c={c}>Date</TH>
              </tr>
            </thead>
            <tbody>
              {stats.recentAnalyses.map((a, i) => (
                <tr key={a.id} style={rowStyle(i, stats.recentAnalyses.length)}>
                  <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: c.textPrimary }}>{a.projects?.name ?? 'Untitled'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{a.email ?? '—'}</td>
                  <td style={{ padding: '11px 16px' }}><ScorePill score={a.avg_score} /></td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{a.concept_score?.toFixed(1) ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{a.spatial_score?.toFixed(1) ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{a.presentation_score?.toFixed(1) ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
