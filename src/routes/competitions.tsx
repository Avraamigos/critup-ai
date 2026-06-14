import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, Clock, ExternalLink, Bookmark, X, Tag } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { CompetitionDiscipline } from '@/lib/database.types'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

type Competition = {
  id: string
  title: string
  image_url: string | null
  summary: string | null
  brief_text: string | null
  discipline: CompetitionDiscipline
  deadline: string
  registration_deadline: string | null
  prize: string | null
  entry_fee: string | null
  student_eligible: boolean
  level: 'beginner' | 'student' | 'professional' | 'any'
  team_required: boolean
  location: string | null
  organizer_url: string | null
}

type DisciplineFilter = 'all' | CompetitionDiscipline
type DeadlineFilter = 'all' | 'week' | 'month'

const DISCIPLINE_TABS: { v: DisciplineFilter; labelKey: string }[] = [
  { v: 'all',          labelKey: 'competitions.discAll' },
  { v: 'architecture', labelKey: 'competitions.discArchitecture' },
  { v: 'interior',     labelKey: 'competitions.discInterior' },
  { v: 'urban',        labelKey: 'competitions.discUrban' },
  { v: 'landscape',    labelKey: 'competitions.discLandscape' },
  { v: 'multi',        labelKey: 'competitions.discMulti' },
]

// entry_fee is free text; the user writes "Free" consistently (see plan).
const isFreeEntry = (fee: string | null) => {
  const f = (fee ?? '').trim().toLowerCase()
  return f === 'free' || f === '0' || f === '$0' || f === '€0'
}

// Whole days from now until the given date (end of that day).
const daysUntil = (dateStr: string): number => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(dateStr)
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((t.getTime() - today.getTime()) / 86_400_000)
}

export function CompetitionsPage() {
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const { theme } = useTheme()
  const c = useColors(theme)
  const { user } = useAuth()
  const dateLocale = i18n.language === 'ru' ? 'ru-RU' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'

  const [comps, setComps] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Competition | null>(null)

  // Filters
  const [discipline, setDiscipline] = useState<DisciplineFilter>('all')
  const [studentOnly, setStudentOnly] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all')
  const [savedOnly, setSavedOnly] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const todayIso = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('competitions')
        .select('id, title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url')
        .eq('is_active', true)
        .gte('deadline', todayIso)
        .order('deadline', { ascending: true })
      setComps((data as Competition[] | null) ?? [])

      if (user) {
        const { data: saved } = await supabase
          .from('saved_competitions')
          .select('competition_id')
          .eq('user_id', user.id)
        setSavedIds(new Set((saved ?? []).map(s => s.competition_id)))
      }
      setLoading(false)
    }
    load()
  }, [user])

  const toggleSave = async (compId: string) => {
    if (!user) return
    const isSaved = savedIds.has(compId)
    setSavedIds(prev => { const n = new Set(prev); if (isSaved) n.delete(compId); else n.add(compId); return n })
    const { error } = isSaved
      ? await supabase.from('saved_competitions').delete().eq('competition_id', compId).eq('user_id', user.id)
      : await supabase.from('saved_competitions').insert({ competition_id: compId, user_id: user.id })
    if (error) {
      setSavedIds(prev => { const n = new Set(prev); if (isSaved) n.add(compId); else n.delete(compId); return n })
    }
  }

  const filtered = useMemo(() => {
    return comps.filter(comp => {
      if (discipline !== 'all' && comp.discipline !== discipline) return false
      if (studentOnly && !comp.student_eligible) return false
      if (freeOnly && !isFreeEntry(comp.entry_fee)) return false
      if (savedOnly && !savedIds.has(comp.id)) return false
      if (deadlineFilter !== 'all') {
        const d = daysUntil(comp.deadline)
        if (deadlineFilter === 'week' && d > 7) return false
        if (deadlineFilter === 'month' && d > 30) return false
      }
      return true
    })
  }, [comps, discipline, studentOnly, freeOnly, savedOnly, savedIds, deadlineFilter])

  // ── Sub-components ──
  const FilterToggle = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button onClick={onClick} style={{
      padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontSize: 12.5, fontWeight: active ? 700 : 500,
      border: `1px solid ${active ? '#F97316' : c.border}`,
      background: active ? 'oklch(0.72 0.18 45 / 0.12)' : 'transparent',
      color: active ? '#F97316' : c.textMuted, transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  )

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', fontFamily: FONT, background: c.bg, overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Header + filters ── */}
      <div style={{ padding: isMobile ? '14px 14px 0' : '16px 24px 0', borderBottom: `1px solid ${c.border}`, flexShrink: 0, background: c.bg }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: 0 }}>{t('competitions.title')}</h1>
          <div style={{ fontSize: 12.5, color: c.textMuted, marginTop: 2 }}>{t('competitions.subtitle')}</div>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {DISCIPLINE_TABS.map(tab => (
            <FilterToggle key={tab.v} active={discipline === tab.v} onClick={() => setDiscipline(tab.v)} label={t(tab.labelKey)} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <FilterToggle active={studentOnly} onClick={() => setStudentOnly(v => !v)} label={t('competitions.studentOnly')} />
          <FilterToggle active={freeOnly} onClick={() => setFreeOnly(v => !v)} label={t('competitions.freeOnly')} />
          <div style={{ width: 1, height: 20, background: c.border, margin: '0 2px' }} />
          <FilterToggle active={deadlineFilter === 'week'} onClick={() => setDeadlineFilter(f => f === 'week' ? 'all' : 'week')} label={t('competitions.closingWeek')} />
          <FilterToggle active={deadlineFilter === 'month'} onClick={() => setDeadlineFilter(f => f === 'month' ? 'all' : 'month')} label={t('competitions.closingMonth')} />
          {user && (
            <>
              <div style={{ width: 1, height: 20, background: c.border, margin: '0 2px' }} />
              <FilterToggle active={savedOnly} onClick={() => setSavedOnly(v => !v)} label={t('competitions.savedFilter')} />
            </>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px' : '20px 24px 40px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${c.border}`, borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <Trophy size={44} color={c.textMuted} strokeWidth={1.4} style={{ marginBottom: 12, opacity: 0.6 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>{t('competitions.emptyTitle')}</div>
            <div style={{ fontSize: 13, color: c.textMuted }}>{t('competitions.emptyDesc')}</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: isMobile ? 14 : 18,
          }}>
            {filtered.map(comp => (
              <CompetitionCard
                key={comp.id}
                comp={comp}
                c={c}
                saved={savedIds.has(comp.id)}
                canSave={!!user}
                onSave={() => toggleSave(comp.id)}
                onOpen={() => setSelected(comp)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {selected && (
        <CompetitionDetail
          comp={selected}
          c={c}
          isMobile={isMobile}
          saved={savedIds.has(selected.id)}
          canSave={!!user}
          onSave={() => toggleSave(selected.id)}
          onClose={() => setSelected(null)}
          t={t}
          dateLocale={dateLocale}
        />
      )}
    </div>
  )
}

// ── Deadline pill ──
function DeadlinePill({ deadline, c, t }: { deadline: string; c: ReturnType<typeof useColors>; t: (k: string, o?: Record<string, unknown>) => string }) {
  const d = daysUntil(deadline)
  const urgent = d <= 7
  const soon = d <= 3
  const color = soon ? 'oklch(0.65 0.2 25)' : urgent ? '#F97316' : c.textMuted
  const label = d === 0 ? t('competitions.closesToday') : d === 1 ? t('competitions.closesTomorrow') : t('competitions.closesInDays', { count: d })
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: urgent ? 700 : 600, color }}>
      <Clock size={12} /> {label}
    </span>
  )
}

// ── Conditional tags ──
function CompTags({ comp, c, t }: { comp: Competition; c: ReturnType<typeof useColors>; t: (k: string) => string }) {
  const tags: string[] = []
  if (comp.student_eligible) tags.push(t('competitions.tagStudent'))
  if (isFreeEntry(comp.entry_fee)) tags.push(t('competitions.tagFree'))
  if (comp.team_required) tags.push(t('competitions.tagTeam'))
  if (comp.level === 'beginner') tags.push(t('competitions.tagBeginner'))
  if (tags.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tags.map(tag => (
        <span key={tag} style={{
          fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 100,
          background: c.isDark ? 'oklch(0.26 0.004 270)' : '#f3f4f6', color: c.textMuted,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}><Tag size={9} /> {tag}</span>
      ))}
    </div>
  )
}

// ── Card ──
function CompetitionCard({ comp, c, saved, canSave, onSave, onOpen, t }: {
  comp: Competition
  c: ReturnType<typeof useColors>
  saved: boolean
  canSave: boolean
  onSave: () => void
  onOpen: () => void
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: c.cardBg, borderRadius: 16, border: `1px solid ${c.border}`,
        overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = c.hoverBorder }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = c.border }}
    >
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: c.isDark ? 'oklch(0.16 0.004 270)' : '#f3f4f6', overflow: 'hidden' }}>
        {comp.image_url
          ? <img src={comp.image_url} alt={comp.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trophy size={32} color={c.textMuted} strokeWidth={1.4} /></div>
        }
        {/* Discipline tag */}
        <span style={{
          position: 'absolute', top: 10, left: 10, fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 100,
          background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)', textTransform: 'capitalize',
        }}>{t(`competitions.disc${comp.discipline.charAt(0).toUpperCase() + comp.discipline.slice(1)}`)}</span>
        {/* Save button */}
        {canSave && (
          <button
            onClick={e => { e.stopPropagation(); onSave() }}
            aria-label={t('competitions.save')}
            style={{
              position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
            }}
          >
            <Bookmark size={15} color={saved ? '#F97316' : '#fff'} fill={saved ? '#F97316' : 'none'} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, lineHeight: 1.3 }}>{comp.title}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <DeadlinePill deadline={comp.deadline} c={c} t={t} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: c.textMuted }}>
          {comp.prize && <span style={{ fontWeight: 700, color: c.textPrimary }}>{comp.prize}</span>}
          {comp.entry_fee && <span>{isFreeEntry(comp.entry_fee) ? t('competitions.tagFree') : comp.entry_fee}</span>}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <CompTags comp={comp} c={c} t={t} />
        </div>
      </div>
    </div>
  )
}

// ── Detail modal ──
function CompetitionDetail({ comp, c, isMobile, saved, canSave, onSave, onClose, t, dateLocale }: {
  comp: Competition
  c: ReturnType<typeof useColors>
  isMobile: boolean
  saved: boolean
  canSave: boolean
  onSave: () => void
  onClose: () => void
  t: (k: string, o?: Record<string, unknown>) => string
  dateLocale: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fmtDate = (s: string) => new Date(s).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${c.border}` }}>
      <span style={{ fontSize: 13, color: c.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, textAlign: 'right' }}>{value}</span>
    </div>
  )

  const levelLabel = t(`competitions.level${comp.level.charAt(0).toUpperCase() + comp.level.slice(1)}`)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: c.cardBg, borderRadius: isMobile ? '18px 18px 0 0' : 18, border: `1px solid ${c.border}`,
          width: '100%', maxWidth: 560, maxHeight: isMobile ? '92vh' : '88vh', overflowY: 'auto', position: 'relative',
        }}
      >
        {/* Close */}
        <button onClick={onClose} aria-label={t('common.close')} style={{
          position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', zIndex: 2,
          background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }}><X size={17} color="#fff" /></button>

        {/* Image */}
        <div style={{ aspectRatio: '16 / 9', background: c.isDark ? 'oklch(0.16 0.004 270)' : '#f3f4f6', overflow: 'hidden', borderRadius: isMobile ? '18px 18px 0 0' : '18px 18px 0 0' }}>
          {comp.image_url
            ? <img src={comp.image_url} alt={comp.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trophy size={40} color={c.textMuted} strokeWidth={1.4} /></div>
          }
        </div>

        <div style={{ padding: isMobile ? 18 : 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, margin: 0, lineHeight: 1.25 }}>{comp.title}</h2>
            {canSave && (
              <button onClick={onSave} aria-label={t('competitions.save')} style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: `1px solid ${c.border}`,
                background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bookmark size={16} color={saved ? '#F97316' : c.textMuted} fill={saved ? '#F97316' : 'none'} />
              </button>
            )}
          </div>

          <div style={{ marginBottom: 14 }}><DeadlinePill deadline={comp.deadline} c={c} t={t} /></div>

          <div style={{ marginBottom: 16 }}><CompTags comp={comp} c={c} t={t} /></div>

          {comp.summary && (
            <p style={{ fontSize: 14, color: c.textPrimary, lineHeight: 1.6, margin: '0 0 18px' }}>{comp.summary}</p>
          )}

          {/* Info table */}
          <div style={{ marginBottom: 20 }}>
            <InfoRow label={t('competitions.fieldDeadline')} value={fmtDate(comp.deadline)} />
            {comp.registration_deadline && <InfoRow label={t('competitions.fieldRegDeadline')} value={fmtDate(comp.registration_deadline)} />}
            {comp.prize && <InfoRow label={t('competitions.fieldPrize')} value={comp.prize} />}
            {comp.entry_fee && <InfoRow label={t('competitions.fieldEntryFee')} value={isFreeEntry(comp.entry_fee) ? t('competitions.tagFree') : comp.entry_fee} />}
            <InfoRow label={t('competitions.fieldLevel')} value={levelLabel} />
            <InfoRow label={t('competitions.fieldTeam')} value={comp.team_required ? t('competitions.yes') : t('competitions.no')} />
            {comp.location && <InfoRow label={t('competitions.fieldLocation')} value={comp.location} />}
          </div>

          {/* CTA */}
          {comp.organizer_url && (
            <a
              href={comp.organizer_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '13px 0', borderRadius: 100, background: '#F97316',
                color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 0 22px oklch(0.72 0.18 45 / 0.35)',
              }}
            >
              {t('competitions.visitSite')} <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
