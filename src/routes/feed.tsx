import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { TrendingUp, Clock, Heart, MessageCircle, Share2, Check } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { SlideCarousel } from '@/components/SlideCarousel'
import { ImageCarousel } from '@/components/ImageCarousel'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
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
  slides: string[]
  pdf_url: string | null
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

const AVATAR_COLORS = ['#F97316', 'oklch(0.6 0.18 250)', 'oklch(0.62 0.17 160)', 'oklch(0.62 0.2 320)', 'oklch(0.65 0.18 25)']

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post, c, theme, liked, likeCount, commentCount, onToggleLike, onCopy,
}: {
  post: Post
  c: ReturnType<typeof useColors>
  theme: 'dark' | 'light'
  liked: boolean
  likeCount: number
  commentCount: number
  onToggleLike: (id: string) => void
  onCopy: (id: string) => void
}) {
  const navigate = useNavigate()
  const stageLabel = STAGE_LABELS[post.project_stage] ?? post.project_stage
  const dateStr = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const name = post.owner_name ?? 'Anonymous'

  return (
    <div style={{
      background: c.cardBg,
      border: `1px solid ${c.border}`,
      borderRadius: 18,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Author header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: avatarColor(name), color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
        }}>{initials(name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11.5, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.project_name}</span>
            {stageLabel && <span style={{ color: '#F97316' }}>· {stageLabel}</span>}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: c.textMuted, flexShrink: 0 }}>{dateStr}</div>
      </div>

      {/* ── Slides ── */}
      {post.slides.length > 0 ? (
        <div style={{ padding: '0 12px' }}>
          <ImageCarousel images={post.slides} aspect={0.7} />
        </div>
      ) : post.pdf_url ? (
        <div style={{ padding: '0 12px' }}>
          <SlideCarousel url={post.pdf_url} aspect={0.7} renderScale={1.5} />
        </div>
      ) : (
        <div style={{ margin: '0 12px', borderRadius: 14, height: 160, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, fontSize: 12 }}>
          Drawings unavailable
        </div>
      )}

      {/* ── Score row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 16px 6px' }}>
        {[
          { label: 'Concept',      score: post.concept_score },
          { label: 'Spatial',      score: post.spatial_score },
          { label: 'Presentation', score: post.presentation_score },
        ].map(r => (
          <ScoreRing key={r.label} score={r.score} label={r.label} size={58} theme={theme} animated={false} />
        ))}
      </div>

      {/* ── Caption ── */}
      {post.caption && (
        <div style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.5, padding: '4px 16px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <span style={{ fontWeight: 700 }}>{name}</span> {post.caption}
        </div>
      )}

      {/* ── Social bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 14px' }}>
        <button
          onClick={() => onToggleLike(post.id)}
          aria-label={liked ? 'Unlike' : 'Like'}
          style={socialBtn(liked ? 'oklch(0.65 0.22 20)' : c.textMuted)}
        >
          <Heart size={18} fill={liked ? 'oklch(0.65 0.22 20)' : 'none'} />
          {likeCount > 0 && <span style={{ fontSize: 13, fontWeight: 600 }}>{likeCount}</span>}
        </button>
        <button
          onClick={() => navigate({ to: `/p/${post.id}` })}
          aria-label="Comments"
          style={socialBtn(c.textMuted)}
        >
          <MessageCircle size={18} />
          {commentCount > 0 && <span style={{ fontSize: 13, fontWeight: 600 }}>{commentCount}</span>}
        </button>
        <button
          onClick={() => onCopy(post.id)}
          aria-label="Share"
          style={{ ...socialBtn(c.textMuted), marginLeft: 'auto' }}
        >
          <Share2 size={18} />
        </button>
      </div>
    </div>
  )
}

function socialBtn(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 8px', borderRadius: 100, border: 'none',
    background: 'transparent', color, cursor: 'pointer',
  }
}

// ─── Feed page ────────────────────────────────────────────────────────────────

export function FeedPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const { user } = useAuth()
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [posts, setPosts]           = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [sort, setSort]             = useState<'recent' | 'top'>('top')
  const [discipline, setDiscipline] = useState<Discipline>('all')
  const [copiedId, setCopiedId]     = useState<string | null>(null)

  const [likeCounts, setLikeCounts]       = useState<Record<string, number>>({})
  const [likedByMe, setLikedByMe]         = useState<Set<string>>(new Set())
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const query = supabase
        .from('analyses')
        .select(`
          id, user_id, concept_score, spatial_score, presentation_score, created_at, caption, pdf_path, slide_count,
          projects ( name, stage, discipline )
        `)
        .eq('is_public', true)
        .eq('status', 'complete')
        .limit(50)

      if (sort === 'recent') {
        query.order('created_at', { ascending: false })
      } else {
        query.order('concept_score', { ascending: false })
      }

      const { data, error } = await query
      if (error) console.warn('feed query error', error)
      if (!data) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = data as any[]

      // Author names: fetched separately (no FK from analyses → profiles, so we
      // can't embed it). Batched into one query keyed by user_id.
      const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[]
      const nameById: Record<string, string> = {}
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
        profs?.forEach(p => { if (p.full_name) nameById[p.id] = p.full_name })
      }

      // Pre-rendered slides are public images — only fall back to signing the
      // raw PDF for legacy posts that have no rendered slides yet.
      const fallbackPaths = rows
        .filter(r => !(r.slide_count > 0) && r.pdf_path)
        .map(r => r.pdf_path) as string[]
      const urlByPath: Record<string, string> = {}
      if (fallbackPaths.length) {
        const { data: signed } = await supabase.storage.from('project-pdfs').createSignedUrls(fallbackPaths, 7200)
        signed?.forEach(s => { if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl })
      }

      const slideUrls = (id: string, count: number) =>
        Array.from({ length: count }, (_, i) =>
          supabase.storage.from('post-slides').getPublicUrl(`${id}/${i}.jpg`).data.publicUrl)

      let mapped: Post[] = rows.map(row => ({
        id: row.id,
        concept_score: Number(row.concept_score) || 0,
        spatial_score: Number(row.spatial_score) || 0,
        presentation_score: Number(row.presentation_score) || 0,
        created_at: row.created_at,
        project_name: row.projects?.name ?? 'Untitled',
        project_stage: row.projects?.stage ?? '',
        project_discipline: row.projects?.discipline ?? null,
        owner_name: nameById[row.user_id] ?? null,
        caption: row.caption ?? null,
        slides: row.slide_count > 0 ? slideUrls(row.id, row.slide_count) : [],
        pdf_url: row.pdf_path ? (urlByPath[row.pdf_path] ?? null) : null,
      }))

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

      // Batch-load like & comment counts for the visible posts
      const ids = mapped.map(p => p.id)
      if (ids.length) {
        const [{ data: likes }, { data: comments }] = await Promise.all([
          supabase.from('post_likes').select('analysis_id, user_id').in('analysis_id', ids),
          supabase.from('post_comments').select('analysis_id').in('analysis_id', ids),
        ])
        const lc: Record<string, number> = {}
        const mine = new Set<string>()
        likes?.forEach(l => {
          lc[l.analysis_id] = (lc[l.analysis_id] ?? 0) + 1
          if (user && l.user_id === user.id) mine.add(l.analysis_id)
        })
        const cc: Record<string, number> = {}
        comments?.forEach(cm => { cc[cm.analysis_id] = (cc[cm.analysis_id] ?? 0) + 1 })
        setLikeCounts(lc)
        setLikedByMe(mine)
        setCommentCounts(cc)
      }
    }
    load()
  }, [sort, discipline, user])

  const handleToggleLike = async (id: string) => {
    if (!user) return
    const isLiked = likedByMe.has(id)
    // Optimistic
    setLikedByMe(prev => {
      const next = new Set(prev)
      if (isLiked) next.delete(id); else next.add(id)
      return next
    })
    setLikeCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (isLiked ? -1 : 1)) }))

    const { error } = isLiked
      ? await supabase.from('post_likes').delete().eq('analysis_id', id).eq('user_id', user.id)
      : await supabase.from('post_likes').insert({ analysis_id: id, user_id: user.id })

    if (error) {
      // Revert on failure
      setLikedByMe(prev => {
        const next = new Set(prev)
        if (isLiked) next.add(id); else next.delete(id)
        return next
      })
      setLikeCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (isLiked ? 1 : -1)) }))
    }
  }

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 540, margin: '0 auto' }}>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                c={c}
                theme={theme}
                liked={likedByMe.has(post.id)}
                likeCount={likeCounts[post.id] ?? 0}
                commentCount={commentCounts[post.id] ?? 0}
                onToggleLike={handleToggleLike}
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
