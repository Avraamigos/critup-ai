import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from '@tanstack/react-router'

import { ArrowRight, AlertCircle, Heart, Send, MessageCircle, Share2, Check, Trash2 } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { SlideCarousel } from '@/components/SlideCarousel'
import { ImageCarousel } from '@/components/ImageCarousel'
import { CritupLogo } from '@/components/CritupLogo'
import { ProfilePopover } from '@/components/ProfilePopover'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { sharePost } from '@/lib/share'

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedbackItem = { title: string; text: string; suggestion: string }

type Comment = {
  id: string
  body: string
  created_at: string
  author_name: string | null
  author_avatar_url: string | null
  user_id: string
}

type PostData = {
  id: string
  user_id: string
  concept_score: number
  spatial_score: number
  presentation_score: number
  feedback: FeedbackItem[]
  jury_questions: string[]
  created_at: string
  project: {
    name: string
    stage: string
  }
  owner_name: string | null
  owner_avatar_url: string | null
  caption: string | null
  slides: string[]
  pdf_url: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 8 ? 'oklch(0.72 0.17 145)' : s >= 6 ? '#F97316' : 'oklch(0.65 0.18 25)'

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

function Avatar({ name, avatarUrl, size = 32 }: { name: string; avatarUrl: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  if (avatarUrl && !err) {
    return (
      <img src={avatarUrl} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: avatarColor(name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700 }}>
      {initials(name)}
    </div>
  )
}

function actionBtn(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '8px 12px', borderRadius: 100, border: 'none',
    background: 'transparent', color, cursor: 'pointer',
  }
}

function DotGrid() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PostPage() {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'ru' ? 'ru-RU' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'
  const { analysisId } = useParams({ from: '/p/$analysisId' })
  const navigate = useNavigate()
  const { user, profile: myProfile } = useAuth()
  const myAvatarUrl = (user?.user_metadata?.avatar_url as string | null) ?? null
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked]         = useState(false)
  const [comments, setComments]   = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [posting, setPosting]     = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [copied, setCopied]       = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)

  const handleShare = async () => {
    if (!post) return
    const result = await sharePost(post.id, { text: t('feed.shareText', { name: post.project.name }) })
    if (result === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('analyses')
        .select(`
          id, user_id, concept_score, spatial_score, presentation_score,
          feedback, jury_questions, created_at, caption, pdf_path, slide_count,
          owner_name, owner_avatar_url, project_name, project_stage
        `)
        .eq('id', analysisId)
        .eq('is_public', true)
        .eq('status', 'complete')
        .single()

      if (error || !data) { setNotFound(true); setLoading(false); return }

      // Project meta + author name are denormalized onto the analysis row at
      // publish time (migration 013). Reading projects/profiles directly would
      // fail here for non-owners under owner-only RLS.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proj = { name: (data as any).project_name as string | null, stage: (data as any).project_stage as string | null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfPath = (data as any).pdf_path as string | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slideCount = Number((data as any).slide_count) || 0

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerName = ((data as any).owner_name as string | null) ?? null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerAvatarUrl = ((data as any).owner_avatar_url as string | null) ?? null

      // Pre-rendered slides are public; only sign the raw PDF for legacy posts.
      const slides = slideCount > 0
        ? Array.from({ length: slideCount }, (_, i) =>
            supabase.storage.from('post-slides').getPublicUrl(`${data.id}/${i}.jpg`).data.publicUrl)
        : []

      let pdfUrl: string | null = null
      if (pdfPath && slideCount === 0) {
        const { data: signed } = await supabase.storage.from('project-pdfs').createSignedUrl(pdfPath, 7200)
        pdfUrl = signed?.signedUrl ?? null
      }

      setPost({
        id: data.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user_id: (data as any).user_id,
        concept_score: Number(data.concept_score) || 0,
        spatial_score: Number(data.spatial_score) || 0,
        presentation_score: Number(data.presentation_score) || 0,
        feedback: (data.feedback as FeedbackItem[]) || [],
        jury_questions: (data.jury_questions as string[]) || [],
        created_at: data.created_at,
        project: { name: proj?.name ?? t('post.untitledProject'), stage: proj?.stage ?? '' },
        owner_name: ownerName,
        owner_avatar_url: ownerAvatarUrl,
        caption: (data as { caption?: string | null }).caption ?? null,
        slides,
        pdf_url: pdfUrl,
      })
      setLoading(false)

      // Likes + comments
      const [{ data: likes }, { data: cmts }] = await Promise.all([
        supabase.from('post_likes').select('user_id').eq('analysis_id', analysisId),
        supabase.from('post_comments')
          .select('id, body, created_at, author_name, author_avatar_url, user_id')
          .eq('analysis_id', analysisId)
          .order('created_at', { ascending: true }),
      ])
      setLikeCount(likes?.length ?? 0)
      setLiked(!!(user && likes?.some(l => l.user_id === user.id)))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setComments((cmts as any[] ?? []).map(r => ({
        id: r.id, body: r.body, created_at: r.created_at,
        author_name: r.author_name ?? null,
        author_avatar_url: r.author_avatar_url ?? null,
        user_id: r.user_id,
      })))
    }
    load()
  }, [analysisId, user])

  const handleToggleLike = async () => {
    if (!user) { navigate({ to: '/login' }); return }
    const was = liked
    setLiked(!was)
    setLikeCount(n => Math.max(0, n + (was ? -1 : 1)))
    const { error } = was
      ? await supabase.from('post_likes').delete().eq('analysis_id', analysisId).eq('user_id', user.id)
      : await supabase.from('post_likes').insert({ analysis_id: analysisId, user_id: user.id })
    if (error) { setLiked(was); setLikeCount(n => Math.max(0, n + (was ? 1 : -1))) }
  }

  const handleAddComment = async () => {
    const body = commentBody.trim()
    if (!body) return
    if (!user) { navigate({ to: '/login' }); return }
    setPosting(true)
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ analysis_id: analysisId, user_id: user.id, body: body.slice(0, 1000), author_name: myProfile?.full_name ?? null, author_avatar_url: myAvatarUrl })
      .select('id, created_at')
      .single()
    setPosting(false)
    if (error || !data) return
    setComments(prev => [...prev, {
      id: data.id, body: body.slice(0, 1000), created_at: data.created_at,
      author_name: myProfile?.full_name ?? null,
      author_avatar_url: myAvatarUrl,
      user_id: user.id,
    }])
    setCommentBody('')
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', user.id)
    if (error) return
    setConfirmDelId(null)
    setComments(prev => prev.filter(cm => cm.id !== commentId))
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ width: 36, height: 36, border: '3px solid oklch(0.28 0.004 270)', borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Not found ──
  if (notFound || !post) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: '#fff', gap: 16 }}>
        <AlertCircle size={40} color="oklch(0.65 0.18 25)" />
        <div style={{ fontSize: 20, fontWeight: 700 }}>{t('post.notFoundTitle')}</div>
        <div style={{ fontSize: 14, color: 'oklch(0.55 0.004 270)' }}>{t('post.notFoundBody')}</div>
        <button
          onClick={() => navigate({ to: '/' })}
          style={{ marginTop: 8, padding: '10px 24px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          {t('post.goToCritup')}
        </button>
      </div>
    )
  }

  const avg = ((post.concept_score + post.spatial_score + post.presentation_score) / 3)
  const stageLabel = post.project.stage ? t(`stages.${post.project.stage}`, { defaultValue: post.project.stage }) : ''
  const topFeedback = post.feedback.slice(0, 3)
  const topQuestions = post.jury_questions.slice(0, 3)
  const dateStr = new Date(post.created_at).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })

  const rings = [
    { label: t('scores.concept'),      score: post.concept_score },
    { label: t('scores.spatial'),      score: post.spatial_score },
    { label: t('scores.presentation'), score: post.presentation_score },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', fontFamily: FONT, color: '#fff', position: 'relative' }}>
      <DotGrid />

      {/* Glow */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '40%', background: 'radial-gradient(ellipse, oklch(0.72 0.18 45 / 0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <CritupLogo size={20} theme="dark" />
          <button
            onClick={() => navigate({ to: '/signup' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {t('post.tryForFree')} <ArrowRight size={14} />
          </button>
        </div>

        {/* ── Project identity ── */}
        <div style={{ marginBottom: 32 }}>
          {stageLabel && (
            <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F97316', background: 'oklch(0.72 0.18 45 / 0.12)', padding: '4px 12px', borderRadius: 100, marginBottom: 12 }}>
              {stageLabel}
            </div>
          )}
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 12, color: '#fff' }}>
            {post.project.name}
          </h1>
          {post.owner_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <ProfilePopover userId={post.user_id} name={post.owner_name} avatarUrl={post.owner_avatar_url} theme="dark">
                <Avatar name={post.owner_name} avatarUrl={post.owner_avatar_url} size={36} />
              </ProfilePopover>
              <div>
                <ProfilePopover userId={post.user_id} name={post.owner_name} avatarUrl={post.owner_avatar_url} theme="dark">
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{post.owner_name}</div>
                </ProfilePopover>
                <div style={{ fontSize: 11.5, color: 'oklch(0.55 0.004 270)' }}>{dateStr}</div>
              </div>
            </div>
          )}
          {!post.owner_name && (
            <div style={{ fontSize: 13, color: 'oklch(0.55 0.004 270)', marginBottom: 4 }}>{dateStr}</div>
          )}
          {post.caption && (
            <p style={{ fontSize: 15, color: 'oklch(0.82 0.004 270)', lineHeight: 1.6, margin: '16px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {post.caption}
            </p>
          )}
        </div>

        {/* ── Slides ── */}
        {post.slides.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <ImageCarousel images={post.slides} aspect={0.72} />
          </div>
        ) : post.pdf_url ? (
          <div style={{ marginBottom: 24 }}>
            <SlideCarousel url={post.pdf_url} aspect={0.72} maxPages={20} />
          </div>
        ) : null}

        {/* ── Action row: Like · Comment · Share ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: showComments ? 20 : 24, paddingBottom: 18, borderBottom: '1px solid oklch(0.18 0.004 270)' }}>
          <button
            onClick={handleToggleLike}
            aria-label={liked ? t('feed.unlike') : t('feed.like')}
            style={actionBtn(liked ? 'oklch(0.7 0.2 20)' : 'oklch(0.7 0.004 270)')}
          >
            <Heart size={20} fill={liked ? 'oklch(0.7 0.2 20)' : 'none'} />
            {likeCount > 0 && <span style={{ fontSize: 14, fontWeight: 600 }}>{likeCount}</span>}
          </button>
          <button
            onClick={() => setShowComments(v => !v)}
            aria-label={t('feed.comments')}
            aria-expanded={showComments}
            style={actionBtn(showComments ? '#F97316' : 'oklch(0.7 0.004 270)')}
          >
            <MessageCircle size={20} />
            {comments.length > 0 && <span style={{ fontSize: 14, fontWeight: 600 }}>{comments.length}</span>}
          </button>
          <button
            onClick={handleShare}
            aria-label={t('feed.share')}
            style={{ ...actionBtn('oklch(0.7 0.004 270)'), marginLeft: 'auto' }}
          >
            <Share2 size={20} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t('feed.share')}</span>
          </button>
        </div>

        {/* ── Score rings ── */}
        <div style={{ background: 'oklch(0.14 0.004 270)', border: '1px solid oklch(0.22 0.004 270)', borderRadius: 20, padding: '28px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.55 0.004 270)', marginBottom: 20 }}>{t('post.aiCritiqueScores')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            {rings.map(r => (
              <ScoreRing key={r.label} score={r.score} label={r.label} size={88} theme="dark" />
            ))}
          </div>

          {/* Overall average bar */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid oklch(0.22 0.004 270)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.55 0.004 270)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('post.overall')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, margin: '0 16px' }}>
              <div style={{ flex: 1, height: 5, background: 'oklch(0.22 0.004 270)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ width: `${avg * 10}%`, height: '100%', background: scoreColor(avg), borderRadius: 10, transition: 'width 1s ease' }} />
              </div>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor(avg), fontVariantNumeric: 'tabular-nums' }}>
              {avg.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 500, color: 'oklch(0.55 0.004 270)' }}>/10</span>
            </span>
          </div>
        </div>

        {/* ── Feedback highlights ── */}
        {topFeedback.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.55 0.004 270)', marginBottom: 12 }}>
              {t('post.critiqueHighlights')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topFeedback.map((f, i) => (
                <div key={i} style={{ background: 'oklch(0.14 0.004 270)', border: '1px solid oklch(0.22 0.004 270)', borderLeft: '3px solid #F97316', borderRadius: '0 14px 14px 0', padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'oklch(0.65 0.004 270)', lineHeight: 1.55 }}>{f.text}</div>
                  {f.suggestion && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#F97316', lineHeight: 1.5 }}>
                      → {f.suggestion}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Jury questions ── */}
        {topQuestions.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.55 0.004 270)', marginBottom: 12 }}>
              {t('post.predictedJuryQuestions')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topQuestions.map((q, i) => (
                <div key={i} style={{ background: 'oklch(0.14 0.004 270)', border: '1px solid oklch(0.22 0.004 270)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'oklch(0.75 0.004 270)', lineHeight: 1.55, fontStyle: 'italic' }}>
                  "{q}"
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Comments (toggled by the Comment action above) ── */}
        {showComments && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.55 0.004 270)', marginBottom: 12 }}>
            {t('post.comments')} {comments.length > 0 && `(${comments.length})`}
          </div>

          {/* Add comment */}
          {user ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: comments.length ? 20 : 0 }}>
              <Avatar name={myProfile?.full_name ?? '?'} avatarUrl={(user?.user_metadata?.avatar_url as string | null) ?? null} size={32} />
              <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                <input
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                  maxLength={1000}
                  placeholder={t('feed.addComment')}
                  style={{ flex: 1, background: 'oklch(0.14 0.004 270)', border: '1px solid oklch(0.22 0.004 270)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: FONT }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={posting || !commentBody.trim()}
                  aria-label={t('feed.postComment')}
                  style={{ flexShrink: 0, width: 40, borderRadius: 12, border: 'none', background: commentBody.trim() ? '#F97316' : 'oklch(0.22 0.004 270)', color: '#fff', cursor: commentBody.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate({ to: '/login' })}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px dashed oklch(0.28 0.004 270)', background: 'transparent', color: 'oklch(0.6 0.004 270)', fontSize: 13, cursor: 'pointer', marginBottom: comments.length ? 20 : 0 }}
            >
              {t('post.loginToComment')}
            </button>
          )}

          {/* Thread */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {comments.map(cm => {
              const cname = cm.author_name ?? t('feed.anonymous')
              const isMine = !!user && cm.user_id === user.id
              return (
                <div key={cm.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name={cname} avatarUrl={cm.author_avatar_url} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#fff' }}>
                      <span style={{ fontWeight: 700 }}>{cname}</span>
                      <span style={{ color: 'oklch(0.45 0.004 270)', fontSize: 11, marginLeft: 8 }}>
                        {new Date(cm.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'oklch(0.78 0.004 270)', lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {cm.body}
                    </div>
                  </div>
                  {isMine && (
                    confirmDelId === cm.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                        <button
                          onClick={() => handleDeleteComment(cm.id)}
                          style={{ background: 'oklch(0.65 0.18 25)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}
                        >
                          {t('common.delete')}
                        </button>
                        <button
                          onClick={() => setConfirmDelId(null)}
                          style={{ background: 'none', border: '1px solid oklch(0.3 0.004 270)', cursor: 'pointer', color: 'oklch(0.6 0.004 270)', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelId(cm.id)}
                        aria-label={t('feed.deleteComment')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.45 0.004 270)', padding: 4, display: 'flex', flexShrink: 0, borderRadius: 6 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* ── CTA ── */}
        <div style={{ background: 'linear-gradient(135deg, oklch(0.72 0.18 45 / 0.1), oklch(0.72 0.18 45 / 0.04))', border: '1px solid oklch(0.72 0.18 45 / 0.2)', borderRadius: 20, padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, color: '#fff' }}>
            {t('post.ctaTitle')}
          </div>
          <div style={{ fontSize: 14, color: 'oklch(0.65 0.004 270)', marginBottom: 20, lineHeight: 1.5 }}>
            {t('post.ctaBodyLine1')}<br />{t('post.ctaBodyLine2')}
          </div>
          <button
            onClick={() => navigate({ to: '/signup' })}
            style={{ padding: '12px 32px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 28px oklch(0.72 0.18 45 / 0.4)' }}
          >
            {t('post.ctaButton')}
          </button>
          <div style={{ marginTop: 10, fontSize: 12, color: 'oklch(0.45 0.004 270)' }}>{t('post.noCardRequired')}</div>
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: 'oklch(0.35 0.004 270)' }}>
          {t('post.footer')}
        </div>
      </div>

      {/* Copied toast (shown when native share isn't available and we fall back to copy) */}
      {copied && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'oklch(0.72 0.17 145)', color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 999 }}>
          <Check size={14} /> {t('feed.linkCopied')}
        </div>
      )}
    </div>
  )
}
