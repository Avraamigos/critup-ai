import { useState, useRef, useEffect } from 'react'
import { Instagram, Linkedin, GraduationCap, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'

interface PublicProfile {
  id: string
  full_name: string | null
  university: string | null
  discipline: string | null
  bio: string | null
  instagram: string | null
  linkedin: string | null
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

function igUrl(v: string) {
  const handle = v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')
  return `https://instagram.com/${handle}`
}
function linkedinUrl(v: string) {
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v.replace(/^\/+/, '')}`
}

// Lightweight in-memory cache so re-opening the same author doesn't re-fetch.
const cache = new Map<string, PublicProfile | null>()

export function ProfilePopover({
  userId, name, avatarUrl, theme, children,
}: {
  userId: string
  name: string
  avatarUrl: string | null
  theme: 'dark' | 'light'
  children: React.ReactNode
}) {
  const c = useColors(theme)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<PublicProfile | null>(cache.get(userId) ?? null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || cache.has(userId)) return
    setLoading(true)
    supabase.from('public_profiles').select('id, full_name, university, discipline, bio, instagram, linkedin').eq('id', userId).single()
      .then(({ data }) => {
        const p = (data as PublicProfile | null) ?? null
        cache.set(userId, p)
        setProfile(p)
        setLoading(false)
      })
  }, [open, userId])

  const [imgError, setImgError] = useState(false)

  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>} style={{ position: 'relative', display: 'inline-flex' }}>
      <span onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
        {children}
      </span>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 70,
            width: 280, background: c.cardBg, border: `1px solid ${c.border}`,
            borderRadius: 14, padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            animation: 'pp-in 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <style>{`@keyframes pp-in { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {avatarUrl && !imgError ? (
                <img src={avatarUrl} alt={name} onError={() => setImgError(true)}
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: avatarColor(name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                  {initials(name)}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                {profile?.university && (
                  <div style={{ fontSize: 12, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <GraduationCap size={12} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.university}</span>
                  </div>
                )}
              </div>
            </div>

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                <Loader2 size={16} color={c.textMuted} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {/* Bio */}
            {profile?.bio && (
              <p style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.55, margin: '0 0 12px' }}>{profile.bio}</p>
            )}

            {/* Social links */}
            {(profile?.instagram || profile?.linkedin) && (
              <div style={{ display: 'flex', gap: 8 }}>
                {profile.instagram && (
                  <a href={igUrl(profile.instagram)} target="_blank" rel="noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 9, background: c.isDark ? 'oklch(0.2 0.005 270)' : '#f3f4f6', color: c.textPrimary, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    <Instagram size={14} /> Instagram
                  </a>
                )}
                {profile.linkedin && (
                  <a href={linkedinUrl(profile.linkedin)} target="_blank" rel="noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 9, background: c.isDark ? 'oklch(0.2 0.005 270)' : '#f3f4f6', color: c.textPrimary, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    <Linkedin size={14} /> LinkedIn
                  </a>
                )}
              </div>
            )}

            {!loading && !profile?.bio && !profile?.instagram && !profile?.linkedin && !profile?.university && (
              <p style={{ fontSize: 12, color: c.textMuted, margin: 0, fontStyle: 'italic' }}>No profile details yet.</p>
            )}
          </div>
        </>
      )}
    </span>
  )
}
