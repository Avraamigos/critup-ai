import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from '@supabase/supabase-js'
import { TrendingUp, Clock, Heart, MessageCircle, Share2, Check, Send, Flame } from 'lucide-react'
import { SlideCarousel } from '@/components/SlideCarousel'
import { ImageCarousel } from '@/components/ImageCarousel'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { sharePost } from '@/lib/share'

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
  owner_avatar_url: string | null
  caption: string | null
  slides: string[]
  pdf_url: string | null
}

const DISCIPLINE_TABS: { v: Discipline; labelKey: string; emoji: string }[] = [
  { v: 'all',          labelKey: 'feed.discAll',          emoji: '🌍' },
  { v: 'architecture', labelKey: 'feed.discArchitecture', emoji: '🏛️' },
  { v: 'interior',     labelKey: 'feed.discInterior',     emoji: '🛋️' },
  { v: 'urban',        labelKey: 'feed.discUrban',        emoji: '🏙️' },
]

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

function Avatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false)
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.1)',
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name), color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
    }}>
      {initials(name)}
    </div>
  )
}

function scoreColor(s: number) {
  return s >= 8 ? '#22c55e' : s >= 6 ? '#F97316' : '#ef4444'
}

// ─── Post card ────────────────────────────────────────────────────────────────

type CardComment = { id: string; body: string; created_at: string; author_name: string | null; author_avatar_url?: string | null }

function PostCard({
  post, c, theme, user, liked, likeCount, commentCount, onToggleLike, onCopied, onCommentCountChange,
}: {
  post: Post
  c: ReturnType<typeof useColors>
  theme: 'dark' | 'light'
  user: User | null
  liked: boolean
  likeCount: number
  commentCount: number
  onToggleLike: (id: string) => void
  onCopied: () => void
  onCommentCountChange: (id: string, delta: number) => void
}) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'ru' ? 'ru-RU' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'
  const stageLabel = post.project_stage ? t(`stages.${post.project_stage}`, { defaultValue: post.project_stage }) : ''
  const name = post.owner_name ?? t('feed.anonymous')
  const avg = (post.concept_score + post.spatial_score + post.presentation_score) / 3
  const isHot = avg >= 8.0

  const [expanded, setExpanded]   = useState(false)
  const [comments, setComments]   = useState<CardComment[]>([])
  const [loaded, setLoaded]       = useState(false)
  const [loadingC, setLoadingC]   = useState(false)
  const [body, setBody]           = useState('')
  const [posting, setPosting]     = useState(false)
  const [likeAnim, setLikeAnim]   = useState(false)
  const { profile } = useAuth()

  const myAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null

  const toggleComments = async () => {
    const next = !expanded
    setExpanded(next)
    if (next && !loaded) {
      setLoadingC(true)
      const { data } = await supabase
        .from('post_comments')
        .select('id, body, created_at, author_name')
        .eq('analysis_id', post.id)
        .order('created_at', { ascending: true })
      setComments((data as CardComment[] | null) ?? [])
      setLoaded(true)
      setLoadingC(false)
    }
  }

  const addComment = async () => {
    const text = body.trim()
    if (!text || posting || !user) return
    setPosting(true)
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ analysis_id: post.id, user_id: user.id, body: text.slice(0, 1000), author_name: profile?.full_name ?? null })
      .select('id, created_at')
      .single()
    setPosting(false)
    if (error || !data) return
    setComments(prev => [...prev, { id: data.id, body: text.slice(0, 1000), created_at: data.created_at, author_name: profile?.full_name ?? null }])
    setBody('')
    onCommentCountChange(post.id, 1)
  }

  const handleShare = async () => {
    const result = await sharePost(post.id, { text: t('feed.shareText', { name: post.project_name }) })
    if (result === 'copied') onCopied()
  }

  const handleLike = () => {
    if (!liked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 400) }
    onToggleLike(post.id)
  }

  const liveCommentCount = loaded ? comments.length : commentCount

  const timeAgo = () => {
    const diff = (Date.now() - new Date(post.created_at).getTime()) / 1000
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return new Date(post.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{
      background: c.cardBg,
      border: `1px solid ${c.isDark ? 'oklch(0.22 0.005 270)' : '#e5e7eb'}`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: c.isDark ? '0 1px 12px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
    }}>

      {/* ── Author header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <Avatar name={name} avatarUrl={post.owner_avatar_url} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{name}</span>
            {isHot && <Flame size={13} color="#F97316" />}
          </div>
          <div style={{ fontSize: 11.5, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{post.project_name}</span>
            {stageLabel && <>
              <span style={{ color: c.isDark ? 'oklch(0.4 0.005 270)' : '#d1d5db' }}>·</span>
              <span style={{ color: '#F97316', fontWeight: 600, whiteSpace: 'nowrap' }}>{stageLabel}</span>
            </>}
          </div>
        </div>
        <span style={{ fontSize: 11, color: c.textMuted, flexShrink: 0 }}>{timeAgo()}</span>
      </div>

      {/* ── Slides — edge-to-edge ── */}
      <div style={{ position: 'relative' }}>
        {post.slides.length > 0 ? (
          <ImageCarousel images={post.slides} aspect={0.72} />
        ) : post.pdf_url ? (
          <SlideCarousel url={post.pdf_url} aspect={0.72} renderScale={1.5} />
        ) : (
          <div style={{ height: 200, background: c.isDark ? 'oklch(0.16 0.005 270)' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, fontSize: 12 }}>
            {t('feed.drawingsUnavailable')}
          </div>
        )}

        {/* Average score badge — top-right overlay */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)',
          borderRadius: 100, padding: '4px 10px',
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor(avg), fontVariantNumeric: 'tabular-nums' }}>{avg.toFixed(1)}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>/ 10</span>
        </div>
      </div>

      {/* ── Compact score pills ── */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px 4px', alignItems: 'center' }}>
        {[
          { label: t('scores.concept'),      score: post.concept_score,      abbr: 'C' },
          { label: t('scores.spatial'),      score: post.spatial_score,      abbr: 'S' },
          { label: t('scores.presentation'), score: post.presentation_score, abbr: 'P' },
        ].map(r => (
          <div key={r.abbr} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 100,
            background: c.isDark ? 'oklch(0.2 0.005 270)' : '#f3f4f6',
            border: `1px solid ${c.isDark ? 'oklch(0.28 0.005 270)' : '#e5e7eb'}`,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: c.textMuted }}>{r.abbr}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(r.score), fontVariantNumeric: 'tabular-nums' }}>{r.score.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {/* ── Caption ── */}
      {post.caption && (
        <div style={{ fontSize: 13.5, color: c.textPrimary, lineHeight: 1.55, padding: '6px 14px 2px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <span style={{ fontWeight: 700 }}>{name}</span>{' '}
          <span style={{ color: c.textMuted }}>{post.caption}</span>
        </div>
      )}

      {/* ── Social bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px 10px', gap: 2 }}>
        <button
          onClick={handleLike}
          aria-label={liked ? t('feed.unlike') : t('feed.like')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 100, border: 'none',
            background: 'transparent', cursor: 'pointer',
            color: liked ? '#ef4444' : c.textMuted,
            transform: likeAnim ? 'scale(1.3)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), color 0.15s',
          }}
        >
          <Heart size={20} fill={liked ? '#ef4444' : 'none'} strokeWidth={liked ? 0 : 1.8} />
          {likeCount > 0 && <span style={{ fontSize: 13, fontWeight: 700 }}>{likeCount}</span>}
        </button>

        <button
          onClick={toggleComments}
          aria-label={t('feed.comments')}
          aria-expanded={expanded}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 100, border: 'none',
            background: 'transparent', cursor: 'pointer',
            color: expanded ? '#F97316' : c.textMuted,
            transition: 'color 0.15s',
          }}
        >
          <MessageCircle size={20} strokeWidth={1.8} />
          {liveCommentCount > 0 && <span style={{ fontSize: 13, fontWeight: 700 }}>{liveCommentCount}</span>}
        </button>

        <button
          onClick={handleShare}
          aria-label={t('feed.share')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 100, border: 'none',
            background: 'transparent', cursor: 'pointer',
            color: c.textMuted, marginLeft: 'auto',
          }}
        >
          <Share2 size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Inline comments ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${c.isDark ? 'oklch(0.22 0.005 270)' : '#f0f0f0'}`, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Composer */}
          {user ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Avatar name={profile?.full_name ?? '?'} avatarUrl={myAvatarUrl} size={30} />
              <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', background: c.isDark ? 'oklch(0.19 0.005 270)' : '#f3f4f6', borderRadius: 100, padding: '0 12px 0 14px' }}>
                <input
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                  maxLength={1000}
                  placeholder={t('feed.addComment')}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: c.textPrimary, fontSize: 13, outline: 'none', padding: '9px 0' }}
                />
                <button
                  onClick={addComment}
                  disabled={posting || !body.trim()}
                  aria-label={t('feed.postComment')}
                  style={{ background: 'none', border: 'none', cursor: body.trim() ? 'pointer' : 'default', color: body.trim() ? '#F97316' : c.textMuted, display: 'flex', padding: 0, transition: 'color 0.15s' }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: c.textMuted }}>{t('feed.loginToComment')}</div>
          )}

          {/* Thread */}
          {loadingC ? (
            <div style={{ fontSize: 12.5, color: c.textMuted }}>{t('feed.loadingComments')}</div>
          ) : comments.length === 0 ? (
            <div style={{ fontSize: 12.5, color: c.textMuted }}>{t('feed.noComments')}</div>
          ) : (
            comments.map(cm => {
              const cname = cm.author_name ?? t('feed.anonymous')
              return (
                <div key={cm.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Avatar name={cname} avatarUrl={cm.author_avatar_url ?? null} size={28} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>{cname}</span>
                    {' '}
                    <span style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.5 }}>{cm.body}</span>
                    <div style={{ fontSize: 11, color: c.textMuted, marginTop: 3 }}>
                      {new Date(cm.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Feed page ────────────────────────────────────────────────────────────────

export function FeedPage() {
  const { t } = useTranslation()
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
      // Resilient column list: drop owner_avatar_url if it isn't migrated yet.
      const buildQuery = (withAvatar: boolean) => {
        const cols = `
          id, user_id, concept_score, spatial_score, presentation_score, created_at, caption, pdf_path, slide_count,
          owner_name, ${withAvatar ? 'owner_avatar_url,' : ''} project_name, project_stage, project_discipline
        `
        const q = supabase.from('analyses').select(cols).eq('is_public', true).eq('status', 'complete').limit(50)
        if (sort === 'recent') q.order('created_at', { ascending: false })
        else q.order('concept_score', { ascending: false })
        return q
      }

      let { data, error } = await buildQuery(true)
      if (error && /owner_avatar_url/.test(error.message ?? '')) {
        ;({ data, error } = await buildQuery(false))
      }
      if (error) console.warn('feed query error', error)
      if (!data) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = data as any[]

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
        project_name: row.project_name ?? 'Untitled',
        project_stage: row.project_stage ?? '',
        project_discipline: row.project_discipline ?? null,
        owner_name: row.owner_name ?? null,
        owner_avatar_url: row.owner_avatar_url ?? null,
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
    setLikedByMe(prev => { const n = new Set(prev); if (isLiked) n.delete(id); else n.add(id); return n })
    setLikeCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (isLiked ? -1 : 1)) }))
    const { error } = isLiked
      ? await supabase.from('post_likes').delete().eq('analysis_id', id).eq('user_id', user.id)
      : await supabase.from('post_likes').insert({ analysis_id: id, user_id: user.id })
    if (error) {
      setLikedByMe(prev => { const n = new Set(prev); if (isLiked) n.add(id); else n.delete(id); return n })
      setLikeCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (isLiked ? 1 : -1)) }))
    }
  }

  const showCopiedToast = () => { setCopiedId('x'); setTimeout(() => setCopiedId(null), 2000) }
  const bumpCommentCount = (id: string, delta: number) => {
    setCommentCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))
  }

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', fontFamily: FONT, background: c.bg, overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slide-up { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: '16px 20px 0', borderBottom: `1px solid ${c.border}`, flexShrink: 0, background: c.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: 0 }}>{t('feed.title')}</h1>
            <div style={{ fontSize: 12.5, color: c.textMuted, marginTop: 2 }}>{t('feed.subtitle')}</div>
          </div>

          {/* Sort toggle — pill style */}
          <div style={{ display: 'flex', background: c.isDark ? 'oklch(0.2 0.005 270)' : '#f3f4f6', borderRadius: 100, padding: 3, gap: 2 }}>
            {(['recent', 'top'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 100, border: 'none',
                  background: sort === s ? (s === 'top' ? '#F97316' : c.cardBg) : 'transparent',
                  color: sort === s ? (s === 'top' ? '#fff' : c.textPrimary) : c.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: sort === s ? (s === 'top' ? '0 0 14px oklch(0.72 0.18 45/0.35)' : '0 1px 4px rgba(0,0,0,0.1)') : 'none',
                }}
              >
                {s === 'recent' ? <><Clock size={11} /> {t('feed.recent')}</> : <><TrendingUp size={11} /> {t('feed.top')}</>}
              </button>
            ))}
          </div>
        </div>

        {/* Discipline tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {DISCIPLINE_TABS.map(tab => (
            <button
              key={tab.v}
              onClick={() => setDiscipline(tab.v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 13px', borderRadius: '10px 10px 0 0',
                border: 'none',
                borderBottom: discipline === tab.v ? '2px solid #F97316' : '2px solid transparent',
                background: 'transparent',
                color: discipline === tab.v ? '#F97316' : c.textMuted,
                fontSize: 13, fontWeight: discipline === tab.v ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13 }}>{tab.emoji}</span> {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 40px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${c.border}`, borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>{t('feed.noPostsTitle')}</div>
            <div style={{ fontSize: 13, color: c.textMuted, maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>{t('feed.noPostsBody')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 580, margin: '0 auto' }}>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                c={c}
                theme={theme}
                user={user}
                liked={likedByMe.has(post.id)}
                likeCount={likeCounts[post.id] ?? 0}
                commentCount={commentCounts[post.id] ?? 0}
                onToggleLike={handleToggleLike}
                onCopied={showCopiedToast}
                onCommentCountChange={bumpCommentCount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Copied toast */}
      {copiedId && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'oklch(0.72 0.17 145)', color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 999, animation: 'slide-up 0.2s ease' }}>
          <Check size={14} /> {t('feed.linkCopied')}
        </div>
      )}
    </div>
  )
}
