import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Users, BarChart2, TrendingUp, Zap, Crown, RefreshCw,
  ShieldCheck, AlertTriangle, DollarSign, ExternalLink, StickyNote, Trash2, Plus,
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
  { service: 'ElevenLabs',  cost: 5,   period: 'month', url: 'https://elevenlabs.io',       note: 'Starter — 60k chars/mo (Turbo)' },
  { service: 'Plausible',   cost: 9,   period: 'month', url: 'https://plausible.io',        note: 'Growth plan — 14-day trial' },
  { service: 'Paddle',      cost: 0,   period: 'month', url: 'https://paddle.com',          note: '5% + $0.50 per transaction' },
]
// Anthropic pricing (per million tokens, as of 2025)
const ANTHROPIC_INPUT_PER_MTOK  = 3.00   // claude-sonnet-4-6
const ANTHROPIC_OUTPUT_PER_MTOK = 15.00
const AVG_INPUT_TOKENS  = 55_000  // ~50K PDF + prompts
const AVG_OUTPUT_TOKENS = 2_500
const HAIKU_INPUT_PER_MTOK  = 1.00   // claude-haiku-4-5 (verified Jan 2026)
const HAIKU_OUTPUT_PER_MTOK = 5.00
const AVG_HAIKU_INPUT  = 2_000
const AVG_HAIKU_OUTPUT = 100
// ElevenLabs: ~2100 chars per analysis (7 items × 300 chars avg)
// Starter plan: $5/mo includes 60k chars (Flash/Turbo). Overage rate: $0.08/1K chars.
// Cost below is the OVERAGE rate — first ~28 analyses/mo are covered by the subscription.
const ELEVENLABS_PER_1K_CHARS = 0.08   // overage rate on Starter, Flash/Turbo model
const ELEVENLABS_INCLUDED_CHARS = 60_000  // chars included in Starter plan (Flash/Turbo)
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
  failedAnalyses: Array<{
    id: string; created_at: string; email: string | null
    projects: { name: string } | null; user_id: string
  }>
  recentSignups: Array<{
    id: string; plan: string; discipline: string | null
    full_name: string | null; email: string | null; created_at: string
    analyses_used?: number
  }>
  signupsChart: DayPoint[]
  analysesChart: DayPoint[]
}

type Tab = 'overview' | 'analytics' | 'users' | 'analyses' | 'errors' | 'expenses' | 'notes'

interface AdminNote { id: string; text: string; createdAt: string }
const NOTES_KEY = 'critup_admin_notes'
const NOTES_SEEDED_KEY = 'critup_admin_notes_seeded'

const DEFAULT_NOTES: Omit<AdminNote, 'id'>[] = [
  {
    text: '🔒 Supabase Pro ($25/mo) → enable "Leaked password protection" in Auth → Attack Protection.\nCurrently unavailable on free plan — 1 warning left in Security Advisor.',
    createdAt: new Date('2026-05-29').toISOString(),
  },
  {
    text: '🎙️ ElevenLabs — create a separate API workspace for production.\nCurrently using the ElevenCreative personal workspace. Should have a dedicated workspace so personal and production credits are separate.',
    createdAt: new Date('2026-05-29').toISOString(),
  },
  {
    text: '💳 Paddle KYC — approval still pending (1–3 business days).\nPayments will not process until approved. Check Paddle dashboard.',
    createdAt: new Date('2026-05-29').toISOString(),
  },
  {
    text: '📧 Welcome email — not built yet.\nWhen a user signs up, send a transactional welcome email via Resend. Use the Resend Claude Code plugin to build it.',
    createdAt: new Date('2026-05-29').toISOString(),
  },
  {
    text: '📊 Real revenue in admin — MRR is currently estimated from subscriber count × price.\nTo show actual revenue, connect Paddle server API (separate from webhook secret / client token).',
    createdAt: new Date('2026-05-29').toISOString(),
  },
  {
    text: '🔍 SEO / meta tags — not set up.\nAdd og:image, og:title, og:description, twitter:card to index.html for proper social sharing previews.',
    createdAt: new Date('2026-05-29').toISOString(),
  },
  {
    text: '🗄️ Supabase Data API change — Oct 30, 2026.\nFrom that date, new tables in existing projects need explicit GRANT to be accessible via the API.\nSQL to run for any new table:\nGRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO anon, authenticated;',
    createdAt: new Date('2026-05-29').toISOString(),
  },
  {
    text: '🎙️ ElevenLabs Starter plan — 60k chars/mo (Flash/Turbo) ≈ 28 analyses/mo before overage.\nIf monthly analysis volume grows past ~25/mo consistently, upgrade to Creator ($22/mo → 440k chars).',
    createdAt: new Date('2026-05-29').toISOString(),
  },
]

function loadNotes(): AdminNote[] {
  try {
    const existing = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]') as AdminNote[]
    // Seed default notes once on first load
    if (!localStorage.getItem(NOTES_SEEDED_KEY)) {
      const seeded: AdminNote[] = DEFAULT_NOTES.map(n => ({ ...n, id: crypto.randomUUID() }))
      const merged = [...seeded, ...existing]
      localStorage.setItem(NOTES_KEY, JSON.stringify(merged))
      localStorage.setItem(NOTES_SEEDED_KEY, '1')
      return merged
    }
    return existing
  } catch { return [] }
}
function saveNotes(notes: AdminNote[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

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
  const [notes, setNotes]       = useState<AdminNote[]>(loadNotes)
  const [newNote, setNewNote]   = useState('')
  const [dismissedErrors, setDismissedErrors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('critup_dismissed_errors') ?? '[]') } catch { return [] }
  })

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

  async function getJwt() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function togglePlan(userId: string, currentPlan: string) {
    const newPlan = currentPlan === 'free' ? 'monthly' : 'free'
    setTogglingId(userId + ':plan')
    try {
      const res = await fetch('/api/admin-set-plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getJwt()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: newPlan }),
      })
      if (!res.ok) throw new Error(await res.text())
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

  async function resetAnalyses(userId: string) {
    setTogglingId(userId + ':reset')
    try {
      const res = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getJwt()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_analyses', userId }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStats(s => s ? {
        ...s,
        recentSignups: s.recentSignups.map(u => u.id === userId ? { ...u, analyses_used: 0 } : u),
      } : s)
    } catch (e) {
      alert('Failed to reset: ' + e)
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteUser(userId: string, email: string | null) {
    if (!confirm(`Delete user ${email ?? userId}?\n\nThis removes their account, all projects, and all analyses. Cannot be undone.`)) return
    setTogglingId(userId + ':delete')
    try {
      const res = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getJwt()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_user', userId }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStats(s => s ? {
        ...s,
        recentSignups: s.recentSignups.filter(u => u.id !== userId),
        users: { ...s.users, total: s.users.total - 1, free: s.users.free - 1 },
      } : s)
    } catch (e) {
      alert('Failed to delete: ' + e)
    } finally {
      setTogglingId(null)
    }
  }

  function addNote() {
    const text = newNote.trim()
    if (!text) return
    const updated = [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...notes]
    setNotes(updated)
    saveNotes(updated)
    setNewNote('')
  }

  function deleteNote(id: string) {
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated)
    saveNotes(updated)
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
  const analysisCount    = stats?.analyses.total   ?? 0
  const analysisCount30d = stats?.analyses.last30d ?? 0

  const perAnalysisSonnet = (AVG_INPUT_TOKENS  / 1_000_000) * ANTHROPIC_INPUT_PER_MTOK +
                            (AVG_OUTPUT_TOKENS / 1_000_000) * ANTHROPIC_OUTPUT_PER_MTOK
  const perAnalysisHaiku  = (AVG_HAIKU_INPUT  / 1_000_000) * HAIKU_INPUT_PER_MTOK +
                            (AVG_HAIKU_OUTPUT / 1_000_000) * HAIKU_OUTPUT_PER_MTOK
  const perAnalysisTTS    = (AVG_TTS_CHARS / 1000) * ELEVENLABS_PER_1K_CHARS

  const costSonnet = analysisCount * perAnalysisSonnet
  const costHaiku  = analysisCount * perAnalysisHaiku
  // TTS: only chars beyond the monthly included allowance cost anything
  const totalTTSChars   = analysisCount * AVG_TTS_CHARS
  const overageTTSChars = Math.max(0, totalTTSChars - ELEVENLABS_INCLUDED_CHARS)
  const costTTS = (overageTTSChars / 1000) * ELEVENLABS_PER_1K_CHARS
  const fixedMonthly   = FIXED_COSTS.reduce((s, fc) => s + (fc.period === 'month' ? fc.cost : fc.cost / 12), 0)
  const totalEstimated = fixedMonthly + costSonnet + costHaiku + costTTS

  // 30-day view — TTS overage only for chars beyond monthly included
  const ttsChars30d   = analysisCount30d * AVG_TTS_CHARS
  const ttsCost30d    = (Math.max(0, ttsChars30d - ELEVENLABS_INCLUDED_CHARS) / 1000) * ELEVENLABS_PER_1K_CHARS
  const variable30d   = analysisCount30d * (perAnalysisSonnet + perAnalysisHaiku) + ttsCost30d
  const totalCost30d = fixedMonthly + variable30d

  // Revenue estimate
  const subsMonthly  = stats?.planBreakdown?.['monthly'] ?? 0
  const subsYearly   = stats?.planBreakdown?.['yearly']  ?? 0
  const mrrGross     = subsMonthly * 7 + subsYearly * (45 / 12)
  // Paddle fee: 5% + $0.50 per transaction. Yearly fee amortised monthly.
  const paddleFees   = subsMonthly * (7 * 0.05 + 0.50) + subsYearly * ((45 * 0.05 + 0.50) / 12)
  const mrrNet       = mrrGross - paddleFees
  const netMargin30d = mrrNet - totalCost30d
  // How many monthly subs needed to break even on current monthly costs
  const netPerSub    = 7 * 0.95 - 0.50   // ~$6.15 after Paddle
  const breakEven    = netPerSub > 0 ? Math.ceil(totalCost30d / netPerSub) : 0

  const tabs: { id: Tab; label: string; alert?: boolean }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'analytics', label: 'Analytics' },
    { id: 'users',     label: `Users${stats ? ` (${stats.users.total})` : ''}` },
    { id: 'analyses',  label: `Analyses${stats ? ` (${stats.analyses.total})` : ''}` },
    { id: 'errors',    label: `Errors${stats?.analyses.failed ? ` (${Math.max(0, stats.analyses.failed - dismissedErrors.length)})` : ''}`, alert: (stats?.analyses.failed ?? 0) > dismissedErrors.length },
    { id: 'expenses',  label: 'Expenses'  },
    { id: 'notes',     label: `Notes${notes.length ? ` (${notes.length})` : ''}` },
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
            color: tab === t.id ? '#F97316' : t.alert ? '#f87171' : c.textMuted,
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
              <TH c={c}>Actions</TH>
            </tr></thead>
            <tbody>
              {stats.recentSignups.map((u, i) => {
                const busy = togglingId?.startsWith(u.id)
                const isMe = u.email === 'ibro12345@icloud.com'
                return (
                  <tr key={u.id} style={rowStyle(i, stats.recentSignups.length)}>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: c.textPrimary, fontWeight: 500 }}>{u.email ?? '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: c.textMuted }}>{u.full_name ?? '—'}</td>
                    <td style={{ padding: '11px 16px' }}><PlanBadge plan={u.plan} c={c} /></td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: c.textMuted, textTransform: 'capitalize' }}>{u.discipline?.replace(/-/g, ' ') ?? '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{formatDate(u.created_at)}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {!isMe && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Plan toggle */}
                          <button onClick={() => togglePlan(u.id, u.plan)} disabled={!!busy} style={{
                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                            background: u.plan === 'free' ? 'oklch(0.72 0.18 45/0.12)' : 'oklch(0.65 0.18 25/0.10)',
                            color: u.plan === 'free' ? '#F97316' : '#f87171',
                            border: u.plan === 'free' ? '1px solid oklch(0.72 0.18 45/0.3)' : '1px solid oklch(0.65 0.18 25/0.3)',
                            opacity: busy ? 0.5 : 1, transition: 'all 0.15s',
                          }}>
                            {togglingId === u.id + ':plan' ? '…' : u.plan === 'free' ? '→ Pro' : '→ Free'}
                          </button>
                          {/* Reset analyses */}
                          {u.plan === 'free' && (
                            <button onClick={() => resetAnalyses(u.id)} disabled={!!busy} title="Reset free analysis counter to 0" style={{
                              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                              background: 'oklch(0.56 0.18 250/0.12)', color: '#60a5fa',
                              border: '1px solid oklch(0.56 0.18 250/0.3)',
                              opacity: busy ? 0.5 : 1, transition: 'all 0.15s',
                            }}>
                              {togglingId === u.id + ':reset' ? '…' : 'Reset'}
                            </button>
                          )}
                          {/* Delete */}
                          <button onClick={() => deleteUser(u.id, u.email)} disabled={!!busy} title="Delete user and all their data" style={{
                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                            background: 'oklch(0.65 0.18 25/0.10)', color: '#f87171',
                            border: '1px solid oklch(0.65 0.18 25/0.25)',
                            opacity: busy ? 0.5 : 1, transition: 'all 0.15s',
                          }}>
                            {togglingId === u.id + ':delete' ? '…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
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

      {/* ── ERRORS ── */}
      {!loading && stats && tab === 'errors' && (() => {
        const activeErrors = stats.failedAnalyses.filter(a => !dismissedErrors.includes(a.id))
        const dismissAll = () => {
          const ids = stats.failedAnalyses.map(a => a.id)
          setDismissedErrors(ids)
          localStorage.setItem('critup_dismissed_errors', JSON.stringify(ids))
        }
        const dismiss = (id: string) => {
          const next = [...dismissedErrors, id]
          setDismissedErrors(next)
          localStorage.setItem('critup_dismissed_errors', JSON.stringify(next))
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeErrors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: c.textMuted, fontSize: 14 }}>
                <AlertTriangle size={28} color="#22c55e" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 600 }}>No failed analyses — all clear</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'oklch(0.18 0.02 10/0.45)', border: '1px solid oklch(0.3 0.06 10)', borderRadius: 10, fontSize: 13 }}>
                  <AlertTriangle size={14} color="#f87171" />
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{activeErrors.length} failed {activeErrors.length === 1 ? 'analysis' : 'analyses'}</span>
                  <span style={{ color: c.textMuted }}>— shown newest first (max 20)</span>
                  <button onClick={dismissAll} style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: c.textMuted, cursor: 'pointer' }}>
                    Dismiss all
                  </button>
                </div>
                <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <TH c={c}>Project</TH>
                      <TH c={c}>User</TH>
                      <TH c={c}>Date</TH>
                      <TH c={c}></TH>
                    </tr></thead>
                    <tbody>
                      {activeErrors.map((a, i) => (
                        <tr key={a.id} style={rowStyle(i, activeErrors.length)}>
                          <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: c.textPrimary }}>{a.projects?.name ?? 'Untitled'}</td>
                          <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{a.email ?? a.user_id}</td>
                          <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>{formatDate(a.created_at)}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <button onClick={() => dismiss(a.id)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: c.textMuted, cursor: 'pointer' }}>
                              Dismiss
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── EXPENSES ── */}
      {!loading && tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── This month ── */}
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 2px' }}>
            This month — {analysisCount30d} analyses
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <StatCard label="Fixed costs"     value={`$${fixedMonthly.toFixed(2)}`}      sub="recurring"                            icon={DollarSign} c={c} />
            <StatCard label="Variable costs"  value={`$${variable30d.toFixed(2)}`}       sub={`${analysisCount30d} analyses`}       icon={Zap}        c={c} />
            <StatCard label="Total spend"     value={`$${totalCost30d.toFixed(2)}`}      sub="fixed + variable"                     icon={TrendingUp} c={c} />
            <StatCard label="MRR (est)"       value={`$${mrrNet.toFixed(2)}`}            sub={`${subsMonthly}mo · ${subsYearly}yr subs`} icon={Crown} accent={mrrNet > 0} c={c} />
            <StatCard
              label="Net margin"
              value={`${netMargin30d >= 0 ? '+' : ''}$${netMargin30d.toFixed(2)}`}
              sub={netMargin30d >= 0 ? 'profitable' : `need ${breakEven} subs to break even`}
              icon={TrendingUp}
              accent={netMargin30d >= 0}
              warn={netMargin30d < 0}
              c={c}
            />
          </div>

          {/* ── All-time ── */}
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 2px 0' }}>
            All time — {analysisCount} analyses
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <StatCard label="Claude API"      value={`$${(costSonnet + costHaiku).toFixed(2)}`} sub="Sonnet + Haiku" icon={Zap} c={c} />
            <StatCard label="ElevenLabs TTS"  value={`$${costTTS.toFixed(2)}`}              sub="all analyses"                         icon={Zap}        c={c} />
            <StatCard label="Total variable"  value={`$${totalEstimated.toFixed(2)}`}       sub="fixed + variable (all time)"          icon={TrendingUp} c={c} />
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

          {/* Variable costs per analysis */}
          <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Variable costs — per analysis breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH c={c}>Service</TH>
                <TH c={c}>Rate</TH>
                <TH c={c}>Per analysis</TH>
                <TH c={c}>30-day total</TH>
                <TH c={c}>All-time total</TH>
              </tr></thead>
              <tbody>
                {[
                  {
                    service: 'Anthropic (Sonnet)',
                    rate: `$${ANTHROPIC_INPUT_PER_MTOK}/MTok in · $${ANTHROPIC_OUTPUT_PER_MTOK}/MTok out`,
                    perAnalysis: perAnalysisSonnet,
                    total30d: analysisCount30d * perAnalysisSonnet,
                    totalAll: costSonnet,
                  },
                  {
                    service: 'Anthropic (Haiku)',
                    rate: `$${HAIKU_INPUT_PER_MTOK}/MTok in · $${HAIKU_OUTPUT_PER_MTOK}/MTok out`,
                    perAnalysis: perAnalysisHaiku,
                    total30d: analysisCount30d * perAnalysisHaiku,
                    totalAll: costHaiku,
                  },
                  {
                    service: `ElevenLabs TTS (overage only — ${Math.round(ELEVENLABS_INCLUDED_CHARS / AVG_TTS_CHARS)} analyses free/mo)`,
                    rate: `$${ELEVENLABS_PER_1K_CHARS}/1K chars overage · Turbo model`,
                    perAnalysis: perAnalysisTTS,
                    total30d: ttsCost30d,
                    totalAll: costTTS,
                  },
                ].map((row, i, arr) => (
                  <tr key={row.service} style={rowStyle(i, arr.length)}>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{row.service}</td>
                    <td style={{ padding: '11px 16px', fontSize: 11, color: c.textMuted, fontFamily: 'monospace' }}>{row.rate}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: c.textPrimary }}>~${row.perAnalysis.toFixed(4)}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: c.textPrimary }}>${row.total30d.toFixed(3)}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: c.textMuted }}>${row.totalAll.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: c.textMuted, padding: '0 4px' }}>
            * Estimates based on average token/character usage. MRR deducts Paddle fees (5% + $0.50/transaction). Update pricing constants at the top of <code style={{ fontFamily: 'monospace', background: c.isDark ? 'oklch(0.24 0.004 270)' : '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>src/routes/admin.tsx</code> when costs change.
          </div>
        </div>
      )}

      {/* ── NOTES ── */}
      {tab === 'notes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Add note */}
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote() }}
              placeholder="Add a note… (⌘+Enter to save)"
              rows={3}
              style={{
                flex: 1, borderRadius: 10, padding: '10px 14px',
                fontSize: 13, fontFamily: "'Inter', sans-serif",
                background: c.cardBg, border: `1px solid ${c.border}`,
                color: c.textPrimary, resize: 'vertical', outline: 'none',
              }}
            />
            <button onClick={addNote} style={{
              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
              background: '#F97316', border: 'none', borderRadius: 10,
              color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 16px',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <Plus size={14} /> Add
            </button>
          </div>

          {/* Note list */}
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: c.textMuted, fontSize: 14 }}>
              <StickyNote size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
              <div style={{ fontWeight: 600 }}>No notes yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Use this to track things to fix, ideas, reminders</div>
            </div>
          ) : (
            notes.map(note => (
              <div key={note.id} style={{
                background: c.cardBg, border: `1px solid ${c.border}`,
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, color: c.textPrimary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.text}</p>
                  <span style={{ fontSize: 11, color: c.textMuted, marginTop: 6, display: 'block' }}>
                    {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button onClick={() => deleteNote(note.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: c.textMuted, padding: 4, borderRadius: 6, flexShrink: 0,
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = c.textMuted}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
