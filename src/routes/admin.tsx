import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Users, BarChart2, TrendingUp, Zap, Crown, RefreshCw,
  ShieldCheck, AlertTriangle, DollarSign, ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useTheme, useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = ['ibro12345@icloud.com']

// ─── Update these whenever your billing changes ───────────────────────────────
const FIXED_COSTS: { service: string; cost: number; period: 'month' | 'year'; url: string; note: string }[] = [
  { service: 'Vercel',      cost: 0,   period: 'month', url: 'https://vercel.com',          note: 'Hobby plan (free)' },
  { service: 'Supabase',    cost: 0,   period: 'month', url: 'https://supabase.com',        note: 'Free tier' },
  { service: 'Domain',      cost: 15,  period: 'year',  url: 'https://domains.google',      note: 'critup.ai/yr' },
  { service: 'Resend',      cost: 0,   period: 'month', url: 'https://resend.com',          note: 'Free up to 3k emails/mo' },
  { service: 'ElevenLabs',  cost: 0,   period: 'month', url: 'https://elevenlabs.io',       note: 'Check your plan' },
  { service: 'Plausible',   cost: 9,   period: 'month', url: 'https://plausible.io',        note: 'Growth plan — 14-day trial' },
  { service: 'Paddle',      cost: 0,   period: 'month', url: 'https://paddle.com',          note: '5% + $0.50 per transaction' },
]
// Anthropic pricing (per million tokens, as of 2025)
const ANTHROPIC_INPUT_PER_MTOK  = 3.00   // claude-sonnet-4-6
const ANTHROPIC_OUTPUT_PER_MTOK = 15.00
const AVG_INPUT_TOKENS  = 55_000  // ~50K PDF + prompts
const AVG_OUTPUT_TOKENS = 2_500
const HAIKU_INPUT_PER_MTOK  = 0.80
const HAIKU_OUTPUT_PER_MTOK = 4.00
const AVG_HAIKU_INPUT  = 2_000
const AVG_HAIKU_OUTPUT = 100
// ElevenLabs: ~2100 chars per analysis (7 items × 300 chars avg)
const ELEVENLABS_PER_1K_CHARS = 0.30
const AVG_TTS_CHARS = 2100
// ─────────────────────────────────────────────────────────────────────────────

interface DayPoint { date: string; count: number }
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
  signupsChart: DayPoint[]
  analysesChart: DayPoint[]
}

type Tab = 'overview' | 'analytics' | 'users' | 'analyses' | 'expenses'

// ─── Small components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent, warn, c }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent?: boolean; warn?: boolean
  c: ReturnType<typeof useColors>
}) {
  const color  = accent ? '#F97316' : warn ? '#f87171' : c.textPrimary
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, width: 160, color: c.textMuted, flexShrink: 0, textTransform: 'capitalize' }}>{label.replace(/-/g, ' ')}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 100, background: c.isDark ? 'oklch(0.26 0.004 270)' : '#e5e7eb', overflow: 'hidden' }}>
        <div style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: '100%', borderRadius: 100, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary, width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function MiniBarChart({ data, color, label, c }: { data: DayPoint[]; color: string; label: string; c: ReturnType<typeof useColors> }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label} — last 30 days</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, letterSpacing: '-0.03em' }}>{total}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(2, (d.count / max) * 60) : 2
          const isToday = d.date === new Date().toISOString().slice(0, 10)
          return (
            <div key={i} title={`${d.date}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 64 }}>
              <div style={{
                width: '100%', borderRadius: 3,
                height: h,
                background: isToday ? '#F97316' : d.count > 0 ? color : (c.isDark ? 'oklch(0.26 0.004 270)' : '#e5e7eb'),
                transition: 'height 0.4s ease',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: c.textMuted }}>{data[0]?.date.slice(5)}</span>
        <span style={{ fontSize: 10, color: '#F97316', fontWeight: 600 }}>today</span>
        </div>
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
      color: isPro ? '#F97316' : c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>{plan}</span>
  )
}

function ScorePill({ score }: { score: string | null }) {
  if (!score) return <span style={{ fontSize: 12, color: '#6b7280' }}>—</span>
  const n = parseFloat(score)
  return <span style={{ fontSize: 13, fontWeight: 700, color: n >= 7.5 ? '#22c55e' : n >= 5 ? '#F97316' : '#f87171' }}>{score}</span>
}

const TH = ({ children, c }: { children: string; c: ReturnType<typeof useColors> }) => (
  <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${c.border}` }}>
    {children}
  </th>
)

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const c = useColors(theme)

  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab]           = useState<Tab>('overview')
  const [togglingId, setTogglingId] = useState<string | null>(null)

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

  async function togglePlan(userId: string, currentPlan: string) {
    const newPlan = currentPlan === 'free' ? 'monthly' : 'free'
    setTogglingId(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      const res = await fetch('/api/admin-set-plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: newPlan }),
      })
      if (!res.ok) throw new Error(await res.text())
      // Update local state immediately
      setStats(s => s ? {
        ...s,
        recentSignups: s.recentSignups.map(u => u.id === userId ? { ...u, plan: newPlan } : u),
      } : s)
    } catch (e) {
      alert('Failed to update plan: ' + e)
    } finally {
      setTogglingId(null)
    }
  }

  if (authLoading) return null
  if (!isAdmin) return null

  const conversionRate = stats?.users.total
    ? ((stats.users.pro / stats.users.total) * 100).toFixed(1) : '0'
  const errorRate = stats
    ? (stats.analyses.total + stats.analyses.failed > 0
      ? ((stats.analyses.failed / (stats.analyses.total + stats.analyses.failed)) * 100).toFixed(1)
      : '0')
    : '0'

  // Cost calculations
  const analysisCount = stats?.analyses.total ?? 0
  const costSonnet = analysisCount * (
    (AVG_INPUT_TOKENS  / 1_000_000) * ANTHROPIC_INPUT_PER_MTOK +
    (AVG_OUTPUT_TOKENS / 1_000_000) * ANTHROPIC_OUTPUT_PER_MTOK
  )
  const costHaiku = analysisCount * (
    (AVG_HAIKU_INPUT  / 1_000_000) * HAIKU_INPUT_PER_MTOK +
    (AVG_HAIKU_OUTPUT / 1_000_000) * HAIKU_OUTPUT_PER_MTOK
  )
  const costTTS = analysisCount * (AVG_TTS_CHARS / 1000) * ELEVENLABS_PER_1K_CHARS
  const fixedMonthly = FIXED_COSTS.reduce((s, c) => s + (c.period === 'month' ? c.cost : c.cost / 12), 0)
  const totalEstimated = fixedMonthly + costSonnet + costHaiku + costTTS

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'analytics', label: 'Analytics' },
    { id: 'users',     label: `Users${stats ? ` (${stats.users.total})` : ''}` },
    { id: 'analyses',  label: `Analyses${stats ? ` (${stats.analyses.total})` : ''}` },
    { id: 'expenses',  label: 'Expenses'  },
  ]

  const rowStyle = (i: number, total: number) => ({
    borderBottom: i < total - 1 ? `1px solid ${c.border}` : 'none',
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
        <div style={{ color: '#f87171', fontSize: 13, background: 'oklch(0.18 0.02 10/0.5)', border: '1px solid oklch(0.3 0.06 10)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {!loading && stats && tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
            <StatCard label="Total Users"     value={stats.users.total}      sub={`+${stats.users.new7d} this week`}     icon={Users}          c={c} />
            <StatCard label="Pro Subscribers" value={stats.users.pro}        sub={`${conversionRate}% conversion`}        icon={Crown}   accent  c={c} />
            <StatCard label="Free Users"      value={stats.users.free}       sub={`+${stats.users.new30d} this month`}   icon={Users}          c={c} />
            <StatCard label="Total Analyses"  value={stats.analyses.total}   sub={`+${stats.analyses.last7d} this week`} icon={BarChart2}       c={c} />
            <StatCard label="Analyses (30d)"  value={stats.analyses.last30d} sub="completed"                             icon={TrendingUp}      c={c} />
            <StatCard label="Failed"          value={stats.analyses.failed}  sub={`${errorRate}% error rate`}            icon={AlertTriangle}   warn={stats.analyses.failed > 0} c={c} />
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

      {/* ── ANALYTICS ── */}
      {!loading && stats && tab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MiniBarChart data={stats.signupsChart}  color="#6366f1" label="New signups"  c={c} />
          <MiniBarChart data={stats.analysesChart} color="#22c55e" label="Analyses completed" c={c} />
        </div>
      )}

      {/* ── USERS ── */}
      {!loading && stats && tab === 'users' && (
        <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <TH c={c}>Email</TH>
              <TH c={c}>Name</TH>
              <TH c={c}>Plan</TH>
              <TH c={c}>Discipline</TH>
              <TH c={c}>Signed up</TH>
              <TH c={c}>Access</TH>
            </tr></thead>
            <tbody>
              {stats.recentSignups.map((u, i) => (
                <tr key={u.id} style={rowStyle(i, stats.recentSignups.length)}>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: c.textPrimary, fontWeight: 500 }}>{u.email ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: c.textMuted }}>{u.full_name ?? '—'}</td>
                  <td style={{ padding: '11px 16px' }}><PlanBadge plan={u.plan} c={c} /></td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: c.textMuted, textTransform: 'capitalize' }}>{u.discipline?.replace(/-/g, ' ') ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{formatDate(u.created_at)}</td>
                  <td style={{ padding: '11px 16px' }}>
                    {u.email !== 'ibro12345@icloud.com' && (
                      <button
                        onClick={() => togglePlan(u.id, u.plan)}
                        disabled={togglingId === u.id}
                        style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                          background: u.plan === 'free' ? 'oklch(0.72 0.18 45/0.12)' : 'oklch(0.65 0.18 25/0.10)',
                          color: u.plan === 'free' ? '#F97316' : '#f87171',
                          border: u.plan === 'free' ? '1px solid oklch(0.72 0.18 45/0.3)' : '1px solid oklch(0.65 0.18 25/0.3)',
                          opacity: togglingId === u.id ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {togglingId === u.id ? '…' : u.plan === 'free' ? '→ Pro' : '→ Free'}
                      </button>
                    )}
                  </td>
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
            <thead><tr>
              <TH c={c}>Project</TH>
              <TH c={c}>User</TH>
              <TH c={c}>Avg</TH>
              <TH c={c}>C</TH>
              <TH c={c}>S</TH>
              <TH c={c}>P</TH>
              <TH c={c}>Date</TH>
            </tr></thead>
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

      {/* ── EXPENSES ── */}
      {!loading && tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            <StatCard label="Fixed / month"    value={`$${fixedMonthly.toFixed(2)}`}         sub="recurring costs"                      icon={DollarSign} c={c} />
            <StatCard label="Claude API (est)" value={`$${(costSonnet + costHaiku).toFixed(2)}`} sub={`${analysisCount} analyses total`} icon={Zap}        c={c} />
            <StatCard label="ElevenLabs (est)" value={`$${costTTS.toFixed(2)}`}               sub="TTS across all analyses"              icon={Zap}        c={c} />
            <StatCard label="Total spend (est)"value={`$${totalEstimated.toFixed(2)}`}        sub="fixed + variable (all time)"          icon={TrendingUp} accent c={c} />
          </div>

          {/* Fixed costs table */}
          <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Fixed costs — update in code when billing changes
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH c={c}>Service</TH>
                <TH c={c}>Cost</TH>
                <TH c={c}>Billed</TH>
                <TH c={c}>Note</TH>
                <TH c={c}>Link</TH>
              </tr></thead>
              <tbody>
                {FIXED_COSTS.map((row, i) => (
                  <tr key={row.service} style={rowStyle(i, FIXED_COSTS.length)}>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{row.service}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: row.cost === 0 ? '#22c55e' : c.textPrimary, fontWeight: 700 }}>
                      {row.cost === 0 ? 'Free' : `$${row.cost}/${row.period === 'year' ? 'yr' : 'mo'}`}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted, textTransform: 'capitalize' }}>{row.period}ly</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{row.note}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <a href={row.url} target="_blank" rel="noreferrer" style={{ color: c.textMuted, display: 'flex' }}>
                        <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Variable costs */}
          <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Variable costs — estimated based on {analysisCount} total analyses
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH c={c}>Service</TH>
                <TH c={c}>Rate</TH>
                <TH c={c}>Usage</TH>
                <TH c={c}>Total (est)</TH>
                <TH c={c}>Per analysis</TH>
              </tr></thead>
              <tbody>
                {[
                  {
                    service: 'Anthropic (Sonnet)',
                    rate: `$${ANTHROPIC_INPUT_PER_MTOK}/MTok in · $${ANTHROPIC_OUTPUT_PER_MTOK}/MTok out`,
                    usage: `~${(analysisCount * AVG_INPUT_TOKENS / 1_000_000).toFixed(2)}M in / ${(analysisCount * AVG_OUTPUT_TOKENS / 1_000_000).toFixed(2)}M out`,
                    total: `$${costSonnet.toFixed(3)}`,
                    perAnalysis: `~$${((AVG_INPUT_TOKENS / 1_000_000 * ANTHROPIC_INPUT_PER_MTOK) + (AVG_OUTPUT_TOKENS / 1_000_000 * ANTHROPIC_OUTPUT_PER_MTOK)).toFixed(3)}`,
                  },
                  {
                    service: 'Anthropic (Haiku validator)',
                    rate: `$${HAIKU_INPUT_PER_MTOK}/MTok in · $${HAIKU_OUTPUT_PER_MTOK}/MTok out`,
                    usage: `~${(analysisCount * AVG_HAIKU_INPUT / 1_000_000).toFixed(4)}M in / ${(analysisCount * AVG_HAIKU_OUTPUT / 1_000_000).toFixed(4)}M out`,
                    total: `$${costHaiku.toFixed(4)}`,
                    perAnalysis: `~$${((AVG_HAIKU_INPUT / 1_000_000 * HAIKU_INPUT_PER_MTOK) + (AVG_HAIKU_OUTPUT / 1_000_000 * HAIKU_OUTPUT_PER_MTOK)).toFixed(4)}`,
                  },
                  {
                    service: 'ElevenLabs TTS',
                    rate: `$${ELEVENLABS_PER_1K_CHARS}/1K chars`,
                    usage: `~${(analysisCount * AVG_TTS_CHARS / 1000).toFixed(1)}K chars`,
                    total: `$${costTTS.toFixed(3)}`,
                    perAnalysis: `~$${(AVG_TTS_CHARS / 1000 * ELEVENLABS_PER_1K_CHARS).toFixed(3)}`,
                  },
                ].map((row, i, arr) => (
                  <tr key={row.service} style={rowStyle(i, arr.length)}>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{row.service}</td>
                    <td style={{ padding: '11px 16px', fontSize: 11, color: c.textMuted, fontFamily: 'monospace' }}>{row.rate}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{row.usage}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: c.textPrimary }}>{row.total}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{row.perAnalysis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: c.textMuted, padding: '0 4px' }}>
            * Variable costs are estimates based on average token/character usage. Actual billing may differ. Check Anthropic and ElevenLabs dashboards for exact figures. Update the constants at the top of <code style={{ fontFamily: 'monospace', background: c.isDark ? 'oklch(0.24 0.004 270)' : '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>src/routes/admin.tsx</code> when costs change.
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
