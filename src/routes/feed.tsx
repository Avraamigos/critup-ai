import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { TrendingUp, Clock, ExternalLink, Copy, Check } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { useTheme, useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Discipline = 'all' | 'architecture' | 'interior' | 'urban'

type Post = {
  id: string
  concept_score: number
  spatial_score: number
  presentation_score: number
  created_at: string
  project_name: string
  project_stage: string
  project_discipline: string | null
  owner_name: string | null
  caption: string | null
}

const DISCIPLINE_TABS: { v: Discipline; label: string; emoji: string }[] = [
  { v: 'all',          label: 'All',            emoji: '🌍' },
  { v: 'architecture', label: 'Architecture',   emoji: '🏛️' },
  { v: 'interior',     label: 'Interior',       emoji: '🛋️' },
  { v: 'urban',        label: 'Urban',          emoji: '🏙️' },
]

const STAGE_LABELS: Record<string, string> = {
  'pre-design':       'Pre-Design',
  'initial-concept':  'Initial Concept',
  'finalized-design': 'Finalized Design',
  'jury-prep':        'Jury Prep',
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, c, theme, onCopy }: { post: Post; c: ReturnType<typeof useColors>; theme: 'dark' | 'light'; onCopy: (id: string) => void }) {
  const navigate = useNavigate()
  const avg = ((post.concept_score + post.spatial_score + post.presentation_score) / 3)
  const scoreColor = (s: number) => s >= 8 ? 'oklch(0.72 0.17 145)' : s >= 6 ? '#F97316' : 'oklch(0.65 0.18 25)'
  const stageLabel = STAGE_LABELS[post.project_stage] ?? post.project_stage
  const dateStr = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{
      background: c.cardBg,
      border: `1px solid ${c.border}`,
      borderRadius: 18,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      transition: 'border-color 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#F97316')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = c.border)}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {stageLabel && (
            <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F97316', background: 'oklch(0.72 0.18 45 / 0.1)', padding: '3px 10px', borderRadius: 100, marginBottom: 8 }}>
              {stageLabel}
            </div>
          )}
          <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.project_name}
          </div>
          <div style={{ fontSize: 12, color: c.textMuted }}>
            {post.owner_name ?? 'Anonymous'} · {dateStr}
          </div>
        </div>
        {/* Overall score badge */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(avg), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {avg.toFixed(1)}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.textMuted }}>Overall</div>
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <div style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {post.caption}
        </div>
      )}

      {/* Score rings */}
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {[
          { label: 'Concept',      score: post.concept_score },
          { label: 'Spatial',      score: post.spatial_score },
          { label: 'Presentation', score: post.presentation_score },
        ].map(r => (
          <ScoreRing key={r.label} score={r.score} label={r.label} size={68} theme={theme} animated={false} />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: `1px solid ${c.border}` }}>
        <button
          onClick={() => navigate({ to: `/p/${post.id}` })}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted }}
        >
          <ExternalLink size={12} /> View post
        </button>
        <button
          onClick={() => onCopy(post.id)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted }}
        >
          <Copy size={12} /> Copy link
        </button>
      </div>
    </div>
  )
}

// ─── Feed page ────────────────────────────────────────────────────────────────

export function FeedPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [posts, setPosts]           = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [sort, setSort]             = useState<'recent' | 'top'>('top')
  const [discipline, setDiscipline] = useState<Discipline>('all')
  const [copiedId, setCopiedId]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const query = supabase
        .from('analyses')
        .select(`
          id, concept_score, spatial_score, presentation_score, created_at, caption,
          projects ( name, stage, discipline ),
          profiles ( full_name )
        `)
        .eq('is_public', true)
        .eq('status', 'complete')
        .limit(50)

      if (sort === 'recent') {
        query.order('created_at', { ascending: false })
      } else {
        query.order('concept_score', { ascending: false })
      }

      const { data } = await query
      if (!data) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mapped: Post[] = (data as any[]).map(row => ({
        id: row.id,
        concept_score: Number(row.concept_score) || 0,
        spatial_score: Number(row.spatial_score) || 0,
        presentation_score: Number(row.presentation_score) || 0,
        created_at: row.created_at,
        project_name: row.projects?.name ?? 'Untitled',
        project_stage: row.projects?.stage ?? '',
        project_discipline: row.projects?.discipline ?? null,
        owner_name: row.profiles?.full_name ?? null,
        caption: row.caption ?? null,
      }))

      // Filter by discipline tab
      if (discipline !== 'all') {
        mapped = mapped.filter(p => p.project_discipline === discipline)
      }

      if (sort === 'top') {
        mapped.sort((a, b) => {
          const avgA = (a.concept_score + a.spatial_score + a.presentation_score) / 3
          const avgB = (b.concept_score + b.spatial_score + b.presentation_score) / 3
          return avgB - avgA
        })
      }

      setPosts(mapped)
      setLoading(false)
    }
    load()
  }, [sort, discipline])

  const handleCopy = async (id: string) => {
    const url = `${window.location.origin}/p/${id}`
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', fontFamily: FONT, background: c.bg, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 28px 0', borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: 0 }}>Community</h1>
            <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>See what design students are building worldwide</div>
          </div>

          {/* Sort toggle */}
          <div style={{ display: 'flex', background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 100, padding: 3, gap: 2 }}>
            {(['recent', 'top'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 100, border: 'none',
                  background: sort === s ? '#F97316' : 'transparent',
                  color: sort === s ? '#fff' : c.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'recent' ? <><Clock size={11} /> Recent</> : <><TrendingUp size={11} /> Top</>}
              </button>
            ))}
          </div>
        </div>

        {/* Discipline tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {DISCIPLINE_TABS.map(tab => (
            <button
              key={tab.v}
              onClick={() => setDiscipline(tab.v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: '10px 10px 0 0',
                border: `1px solid ${discipline === tab.v ? c.border : 'transparent'}`,
                borderBottom: discipline === tab.v ? `2px solid #F97316` : '2px solid transparent',
                background: discipline === tab.v ? c.cardBg : 'transparent',
                color: discipline === tab.v ? '#F97316' : c.textMuted,
                fontSize: 13, fontWeight: discipline === tab.v ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.emoji}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 40px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${c.border}`, borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>No posts yet</div>
            <div style={{ fontSize: 13, color: c.textMuted }}>Be the first to share your project critique with the community.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                c={c}
                theme={theme}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Copied toast */}
      {copiedId && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'oklch(0.72 0.17 145)', color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 999, animation: 'slide-up 0.2s ease' }}>
          <Check size={14} /> Link copied
          <style>{`@keyframes slide-up { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
        </div>
      )}
    </div>
  )
}
