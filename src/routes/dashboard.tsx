import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Eye, Plus, ArrowRight, Mic, TrendingUp, Calendar, Loader2, Sparkles } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { MONO } from '@/lib/fonts'

type Analysis = {
  id: string
  status: string
  concept_score: number | null
  spatial_score: number | null
  presentation_score: number | null
  created_at: string
}

type Project = {
  id: string
  name: string
  stage: string
  created_at: string
  analyses: Analysis[]
}

// Stage → brand color. The human label is resolved via t(`stages.<key>`).
const STAGE_COLOR: Record<string, string> = {
  'pre-design':       '#6366f1',
  'initial-concept':  '#F97316',
  'finalized-design': 'oklch(0.72 0.17 145)',
  'jury-prep':        'oklch(0.65 0.18 25)',
}

function stageLabel(stage: string, t: TFunction) {
  return t(`stages.${stage}`, { defaultValue: stage })
}

function timeAgo(dateStr: string, t: TFunction) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return t('time.today')
  if (d === 1) return t('time.yesterday')
  if (d < 7) return t('time.daysAgo', { count: d })
  if (d < 30) return t('time.weeksAgo', { count: Math.floor(d / 7) })
  return t('time.monthsAgo', { count: Math.floor(d / 30) })
}

export function DashboardPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)

  // Show upgrade success banner if redirected from Paddle checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded') === '1') {
      setShowUpgradeBanner(true)
      // Clean the URL
      window.history.replaceState({}, '', '/dashboard')
      // Refresh profile to pick up new plan
      void refreshProfile()
      const t = setTimeout(() => setShowUpgradeBanner(false), 6000)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('dashboard.greetingMorning') : hour < 18 ? t('dashboard.greetingAfternoon') : t('dashboard.greetingEvening')
  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || t('dashboard.there')
  const discipline = profile?.discipline
  const disciplineLabel = discipline === 'arch' ? t('disciplines.architecture')
    : discipline === 'interior' ? t('disciplines.interior')
    : discipline === 'urban' ? t('disciplines.urban')
    : discipline === 'landscape' ? t('disciplines.landscape')
    : t('disciplines.student')

  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"
  const isPro = profile?.plan !== 'free'
  const analysesUsed = (profile as { analyses_used?: number } | null)?.analyses_used ?? 0

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const loadProjects = async () => {
      setLoading(true)
      try {
        const result = await Promise.race([
          supabase
            .from('projects')
            .select('id, name, stage, created_at, analyses(id, status, concept_score, spatial_score, presentation_score, created_at)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 10_000)
          ),
        ])
        if (!cancelled) {
          setProjects(((result as { data: unknown }).data as unknown as Project[]) || [])
        }
      } catch {
        // timeout or network error — show empty state, don't hang
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadProjects()
    return () => { cancelled = true }
    // Use user.id (string) not user (object) — prevents double-fire when
    // onAuthStateChange emits INITIAL_SESSION with a new User object reference.
  }, [user?.id])

  // Get active project (most recent with a complete analysis, or just most recent)
  const activeProject = projects.find(p =>
    p.analyses?.some(a => a.status === 'complete')
  ) || projects[0]

  const latestAnalysis = activeProject?.analyses
    ?.filter(a => a.status === 'complete')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  const stage = activeProject
    ? { label: stageLabel(activeProject.stage, t), color: STAGE_COLOR[activeProject.stage] ?? '#F97316' }
    : null

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '28px', maxWidth: 1080, position: 'relative' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      {c.isDark && <div style={{ position: 'fixed', top: 0, right: 0, width: '55%', height: '45%', background: 'radial-gradient(ellipse 60% 40% at 70% 10%, oklch(0.72 0.18 45 / 0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />}

      {/* Upgrade success banner */}
      {showUpgradeBanner && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'linear-gradient(135deg, #F97316, #fb923c)', borderRadius: 14, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px oklch(0.72 0.18 45 / 0.4)', animation: 'slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          <Sparkles size={18} color="#fff" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t('dashboard.welcomeToPro')}</span>
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
        </div>
      )}

      {/* Welcome */}
      <div style={{ marginBottom: isMobile ? 20 : 28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 6 : 10, marginBottom: 3 }}>
          <h1 style={{ fontSize: isMobile ? 26 : 24, fontWeight: 700, letterSpacing: '-0.025em', margin: 0, color: c.textPrimary, fontFamily: FONT }}>
            {greeting}, {displayName}
          </h1>
          <div style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'oklch(0.72 0.18 45 / 0.1)', color: '#F97316', border: '1px solid oklch(0.72 0.18 45 / 0.25)', alignSelf: 'flex-start' }}>
            {disciplineLabel}
          </div>
        </div>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>
          {projects.length === 0 ? t('dashboard.noProjectsSubtitle') : t('dashboard.hasProjectsSubtitle', { count: projects.length })}
        </p>
      </div>

      {/* Free plan usage banner */}
      {!isPro && !loading && (
        <div style={{
          marginBottom: isMobile ? 16 : 20,
          padding: '14px 18px',
          borderRadius: 14,
          background: analysesUsed >= 1
            ? (c.isDark ? 'oklch(0.22 0.015 35)' : '#fff7ed')
            : (c.isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc'),
          border: `1px solid ${analysesUsed >= 1 ? 'oklch(0.72 0.18 45/0.4)' : c.border}`,
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between',
          gap: isMobile ? 12 : 12,
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
            {/* Analyses */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, width: 116 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, fontFamily: FONT }}>{t('dashboard.analyses')}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: analysesUsed >= 1 ? '#F97316' : c.textMuted, fontFamily: MONO }}>{analysesUsed}/1</span>
              </div>
              <div style={{ height: 4, borderRadius: 100, background: c.isDark ? 'oklch(0.30 0.004 270)' : '#e5e7eb', overflow: 'hidden', width: '100%' }}>
                <div style={{ height: '100%', width: `${Math.min(100, analysesUsed * 100)}%`, borderRadius: 100, background: analysesUsed >= 1 ? '#F97316' : 'oklch(0.72 0.18 45/0.5)', transition: 'width 0.4s ease' }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: c.textMuted, fontFamily: FONT, minWidth: 0 }}>
              {analysesUsed >= 1
                ? <span>{t('dashboard.freeUsed')}<span style={{ color: '#F97316', fontWeight: 600 }}>{t('dashboard.upgradeForAccess')}</span></span>
                : t('dashboard.freeRemaining')}
            </div>
          </div>
          <Link to="/pricing" style={{ flexShrink: 0, padding: isMobile ? '10px 16px' : '7px 16px', borderRadius: 100, background: '#F97316', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 0 12px oklch(0.72 0.18 45/0.3)', fontFamily: FONT, textAlign: 'center' }}>
            {analysesUsed >= 1 ? t('dashboard.upgradeNow') : t('dashboard.upgradeToPro')}
          </Link>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <>
          <style>{`
            @keyframes shimmer { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }
            @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
            .sk { border-radius: 8px; animation: shimmer 1.4s ease infinite; background: ${c.isDark
              ? 'linear-gradient(90deg, oklch(0.22 0.004 270) 25%, oklch(0.26 0.004 270) 50%, oklch(0.22 0.004 270) 75%)'
              : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)'}; background-size: 800px 100%; }
          `}</style>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 12 : 18, marginBottom: isMobile ? 12 : 20 }}>
            {/* Active project skeleton */}
            <div style={{ gridColumn: isMobile ? '1' : '1 / 3', background: c.cardBg, borderRadius: 18, padding: isMobile ? 18 : 24, border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <div className="sk" style={{ height: 10, width: 80, marginBottom: 10 }} />
                  <div className="sk" style={{ height: 18, width: '60%', marginBottom: 10 }} />
                  <div className="sk" style={{ height: 10, width: 100 }} />
                </div>
                <div className="sk" style={{ height: 34, width: 110, borderRadius: 100, alignSelf: 'flex-start' }} />
              </div>
              <div style={{ display: 'flex', gap: isMobile ? 12 : 20 }}>
                {[82, 82, 82].map((s, i) => (
                  <div key={i} className="sk" style={{ width: s, height: s, borderRadius: '50%' }} />
                ))}
              </div>
            </div>
            {/* New project skeleton */}
            <div style={{ background: c.cardBg, borderRadius: 18, padding: isMobile ? 18 : 24, border: `1px solid ${c.border}` }}>
              <div className="sk" style={{ width: 40, height: 40, borderRadius: 11, marginBottom: 14 }} />
              <div className="sk" style={{ height: 16, width: '55%', marginBottom: 8 }} />
              <div className="sk" style={{ height: 11, width: '75%' }} />
            </div>
          </div>
          {/* Quick actions skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 10 : 14, marginBottom: isMobile ? 20 : 28 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ background: c.cardBg, borderRadius: 14, padding: isMobile ? 14 : '16px 18px', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="sk" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="sk" style={{ height: 13, width: '50%', marginBottom: 6 }} />
                  <div className="sk" style={{ height: 10, width: '35%' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && (
        <>
          {/* Top row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: isMobile ? 12 : 18,
            marginBottom: isMobile ? 12 : 20,
            position: 'relative', zIndex: 1,
          }}>
            {/* Active project card */}
            {activeProject ? (
              <div style={{
                gridColumn: isMobile ? '1' : '1 / 3',
                background: c.cardBg, borderRadius: 18, padding: isMobile ? '18px' : '24px',
                border: `1px solid ${c.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? 16 : 20 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{t('dashboard.activeProject')}</div>
                    <h2 style={{ fontSize: isMobile ? 16 : 17, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px', color: c.textPrimary, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activeProject.name}
                    </h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ padding: '3px 9px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${stage?.color}18`, color: stage?.color, border: `1px solid ${stage?.color}40`, whiteSpace: 'nowrap' }}>
                        {stage?.label}
                      </div>
                      <span style={{ fontSize: 11, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} color={c.textMuted} /> {timeAgo(activeProject.created_at, t)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate({ to: '/analysis/$projectId', params: { projectId: activeProject.id } })}
                    style={{
                      padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 14px oklch(0.72 0.18 45 / 0.35)',
                      display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Inter',sans-serif",
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                    <Eye size={13} color="#fff" /> {isMobile ? t('dashboard.view') : t('dashboard.viewAnalysis')}
                  </button>
                </div>

                {latestAnalysis ? (
                  <div style={{ display: 'flex', gap: isMobile ? 12 : 20 }}>
                    <ScoreRing score={latestAnalysis.concept_score ?? 0} label={t('scores.concept')} size={isMobile ? 72 : 82} theme={theme} showBand />
                    <ScoreRing score={latestAnalysis.spatial_score ?? 0} label={t('scores.spatial')} size={isMobile ? 72 : 82} theme={theme} showBand />
                    <ScoreRing score={latestAnalysis.presentation_score ?? 0} label={t('scores.presentation')} size={isMobile ? 72 : 82} theme={theme} showBand />
                  </div>
                ) : (
                  <div style={{ padding: '18px', borderRadius: 12, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc', border: `1px solid ${c.border}`, textAlign: 'center' }}>
                    {activeProject.analyses?.some(a => a.status === 'pending' || a.status === 'processing') ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#F97316', fontSize: 13, fontWeight: 600 }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t('dashboard.analysisInProgress')}
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: c.textMuted }}>{t('dashboard.noAnalysisYet')}</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* No projects yet */
              <div style={{
                gridColumn: isMobile ? '1' : '1 / 3',
                background: c.cardBg, borderRadius: 18, padding: isMobile ? '24px 18px' : '32px 24px',
                border: `1.5px dashed ${c.border}`, textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏛</div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: c.textPrimary, fontFamily: FONT }}>{t('dashboard.noProjectsTitle')}</h2>
                <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 20px' }}>{t('dashboard.noProjectsDesc')}</p>
                <button
                  onClick={() => navigate({ to: '/projects/new' })}
                  style={{ padding: '10px 24px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px oklch(0.72 0.18 45 / 0.3)' }}>
                  {t('dashboard.createFirstProject')}
                </button>
              </div>
            )}

            {/* New project */}
            <Link to="/projects/new" style={{
              background: c.cardBg, borderRadius: 18, padding: isMobile ? '18px' : '24px',
              border: `1px solid ${c.border}`,
              cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: isMobile ? 'row' : 'column',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'center' : 'flex-start',
              textDecoration: 'none',
            }}
              onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${c.hoverBorder}`; e.currentTarget.style.boxShadow = '0 0 28px oklch(0.72 0.18 45 / 0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${c.border}`; e.currentTarget.style.boxShadow = 'none' }}
            >
              {c.isDark && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 20%, oklch(0.72 0.18 45 / 0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />}
              <div style={{ display: 'flex', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 12 : 0, flexDirection: isMobile ? 'row' : 'column' }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'oklch(0.72 0.18 45 / 0.1)', border: '1px solid oklch(0.72 0.18 45 / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? 0 : 14, flexShrink: 0 }}>
                  <Plus size={18} color="#F97316" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', margin: isMobile ? 0 : '0 0 6px', color: c.textPrimary, fontFamily: FONT }}>{t('dashboard.newProject')}</h3>
                  {!isMobile && <p style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5, margin: 0 }}>{t('dashboard.newProjectDesc')}</p>}
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#F97316', fontWeight: 600, marginTop: isMobile ? 0 : 18, display: 'flex', alignItems: 'center', gap: 4 }}>
                {t('dashboard.start')} <ArrowRight size={13} color="#F97316" />
              </div>
            </Link>
          </div>

          {/* Quick actions */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
            gap: isMobile ? 10 : 14,
            marginBottom: isMobile ? 20 : 28,
            position: 'relative', zIndex: 1,
          }}>
            {[
              { icon: Mic, label: t('dashboard.juryPractice'), sub: t('dashboard.juryPracticeSub'), to: '/jury', disabled: false },
              { icon: TrendingUp, label: t('dashboard.allProjects'), sub: t('dashboard.projectsCount', { count: projects.length }), to: '/projects', disabled: false },
            ].map(({ icon: Icon, label, sub, to, disabled }) => disabled ? (
              <div key={label} style={{
                background: c.cardBg, borderRadius: 14, padding: isMobile ? '14px' : '16px 18px',
                border: `1px solid ${c.border}`, opacity: 0.55,
                display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 8 : 12, cursor: 'default',
              }}>
                <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f3f4f6', borderRadius: 9, flexShrink: 0 }}>
                  <Icon size={16} color={c.textMuted} strokeWidth={1.6} />
                </div>
                <div>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: c.textMuted, marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 11, color: c.textMuted }}>{sub}</div>
                </div>
              </div>
            ) : (
              <Link key={label} to={to} style={{
                background: c.cardBg, borderRadius: 14, padding: isMobile ? '14px' : '16px 18px',
                border: `1px solid ${c.border}`,
                display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 8 : 12,
                cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = c.hoverBorder; e.currentTarget.style.background = c.isDark ? 'oklch(0.235 0.004 270)' : '#f9fafb' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = c.cardBg }}
              >
                <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f3f4f6', borderRadius: 9, flexShrink: 0 }}>
                  <Icon size={16} color="#F97316" strokeWidth={1.6} />
                </div>
                <div>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: c.textPrimary, marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 11, color: c.textMuted }}>{sub}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent projects list */}
          {projects.length > 0 && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: c.textPrimary }}>{t('dashboard.recentProjects')}</h3>
                <Link to="/projects" style={{ color: '#F97316', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                  {t('dashboard.viewAll')} <ArrowRight size={12} color="#F97316" />
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projects.slice(0, isMobile ? 2 : 3).map(p => {
                  const ps = { label: stageLabel(p.stage, t), color: STAGE_COLOR[p.stage] ?? '#F97316' }
                  const la = p.analyses?.filter(a => a.status === 'complete').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                  return (
                    <Link key={p.id} to="/analysis/$projectId" params={{ projectId: p.id }} style={{
                      background: c.cardBg, borderRadius: 13, padding: isMobile ? '12px 14px' : '14px 18px',
                      border: `1px solid ${c.border}`,
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = c.hoverBorder}
                      onMouseLeave={e => e.currentTarget.style.borderColor = c.border}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                          <div style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${ps.color}18`, color: ps.color, border: `1px solid ${ps.color}40`, whiteSpace: 'nowrap' }}>{ps.label}</div>
                          <span style={{ fontSize: 11, color: c.textMuted }}>{timeAgo(p.created_at, t)}</span>
                        </div>
                      </div>
                      {la ? (
                        <div style={{ display: 'flex', gap: isMobile ? 10 : 14, flexShrink: 0 }}>
                          {([['C', la.concept_score], ['S', la.spatial_score], ['P', la.presentation_score]] as [string, number | null][]).map(([l, v]) => (
                            <div key={l} style={{ textAlign: 'center' }}>
                              {/* Same tiers as ScoreRing: 6+ green, 4–6 amber, <4 red */}
                              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: v === null ? '#999' : v >= 6 ? 'oklch(0.72 0.17 145)' : v >= 4 ? '#F97316' : 'oklch(0.65 0.18 25)' }}>
                                {v !== null ? v.toFixed(1) : '—'}
                              </div>
                              <div style={{ fontFamily: MONO, fontSize: 8.5, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: c.textMuted, flexShrink: 0 }}>No analysis</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
