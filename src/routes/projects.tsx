import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Search, MoreHorizontal, Trash2, ExternalLink } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Map DB enum → display label + color
const STAGE_META: Record<string, { label: string; color: string }> = {
  'pre-design':      { label: 'Pre-Design',      color: '#6366f1' },
  'initial-concept': { label: 'Initial Concept',  color: '#F97316' },
  'finalized-design':{ label: 'Finalized Design', color: 'oklch(0.72 0.17 145)' },
  'jury-prep':       { label: 'Jury Prep',         color: 'oklch(0.65 0.18 25)' },
}

type Project = {
  id: string
  name: string
  stage: string
  created_at: string
  analyses: {
    id: string
    status: string
    concept_score: number | null
    spatial_score: number | null
    presentation_score: number | null
    created_at: string
  }[]
}

function ScoreBox({ label, score, theme }: { label: string; score: number | null; theme: 'dark' | 'light' }) {
  const c_color = score === null ? '#999'
    : score >= 8 ? 'oklch(0.72 0.17 145)'
    : score >= 6 ? '#F97316'
    : 'oklch(0.65 0.18 25)'
  return (
    <div style={{ flex: 1, background: theme === 'dark' ? 'oklch(0.19 0.004 270)' : '#f8fafc', borderRadius: 10, padding: '8px 10px', textAlign: 'center', border: `1px solid ${theme === 'dark' ? 'oklch(0.28 0.004 270)' : '#e5e7eb'}` }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: c_color, fontVariantNumeric: 'tabular-nums' }}>
        {score !== null ? score.toFixed(1) : '—'}
      </div>
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

export function ProjectsPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [menuOpen, setMenuOpen] = useState<string | null>(null) // project id with open menu
  const [deleting, setDeleting] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    if (menuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const loadProjects = async () => {
      setLoading(true)
      try {
        const result = await Promise.race([
          supabase
            .from('projects')
            .select(`id, name, stage, created_at, analyses(id, status, concept_score, spatial_score, presentation_score, created_at)`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
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

    // Realtime: refresh when analyses update
    const sub = supabase
      .channel(`projects-page-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analyses', filter: `user_id=eq.${user.id}` }, loadProjects)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(sub)
    }
    // user?.id (string) not user (object) — prevents double-fire when auth
    // re-emits with a new User reference for the same session.
  }, [user?.id])

  const deleteProject = async (projectId: string) => {
    setDeleting(projectId)
    setMenuOpen(null)
    try {
      // Delete storage files for all analyses
      const project = projects.find(p => p.id === projectId)
      if (project?.analyses?.length) {
        const { data: analysisRows } = await supabase
          .from('analyses')
          .select('pdf_path')
          .eq('project_id', projectId)
        if (analysisRows) {
          const paths = analysisRows.map(a => a.pdf_path).filter(Boolean) as string[]
          if (paths.length) await supabase.storage.from('project-pdfs').remove(paths)
        }
      }
      // Delete analyses rows (project delete won't cascade without a DB trigger)
      await supabase.from('analyses').delete().eq('project_id', projectId)
      // Delete project row
      await supabase.from('projects').delete().eq('id', projectId)
      setProjects(prev => prev.filter(p => p.id !== projectId))
    } catch (e) {
      console.error('Delete failed', e)
    }
    setDeleting(null)
  }

  const filters = ['all', 'pre-design', 'initial-concept', 'finalized-design', 'jury-prep']

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.stage === filter
    return matchSearch && matchFilter
  })

  return (
    <div style={{ padding: '32px 36px', fontFamily: "'Inter',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: 0, fontFamily: FONT }}>
            My Projects
          </h1>
          <p style={{ fontSize: 14, color: c.textMuted, margin: '4px 0 0' }}>
            {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''} · sorted by recent`}
          </p>
        </div>
        <button
          onClick={() => navigate({ to: '/projects/new' })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.35)' }}
        >
          <Plus size={16} /> New project
        </button>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} color={c.textMuted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, boxSizing: 'border-box', background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif" }}
            onFocus={e => e.target.style.borderColor = '#F97316'}
            onBlur={e => e.target.style.borderColor = c.border}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              background: filter === f ? '#F97316' : c.cardBg,
              border: filter === f ? 'none' : `1px solid ${c.border}`,
              color: filter === f ? '#fff' : c.textMuted,
            }}>
              {f === 'all' ? 'All' : STAGE_META[f]?.label ?? f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: c.cardBg, borderRadius: 18, padding: '20px 22px', border: `1px solid ${c.border}`, height: 200, opacity: 0.5 }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: c.textPrimary, margin: '0 0 6px' }}>No projects yet</p>
          <p style={{ fontSize: 14, color: c.textMuted, margin: '0 0 24px' }}>Create your first project to get AI critique</p>
          <button
            onClick={() => navigate({ to: '/projects/new' })}
            style={{ padding: '11px 28px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.35)' }}
          >
            <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />New project
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(p => {
            const stage = STAGE_META[p.stage] ?? { label: p.stage, color: '#F97316' }
            // Get latest complete analysis
            const latestAnalysis = p.analyses
              ?.filter(a => a.status === 'complete')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            const isPending = p.analyses?.some(a => a.status === 'pending' || a.status === 'processing')

            return (
              <div
                key={p.id}
                onClick={() => navigate({ to: '/analysis/$projectId', params: { projectId: p.id } })}
                style={{ background: c.cardBg, borderRadius: 18, padding: '20px 22px', border: `1px solid ${c.border}`, cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#F97316'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 30px oklch(0.72 0.18 45 / 0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c.border; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
              >
                {/* Stage badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, background: `${stage.color}20`, padding: '3px 10px', borderRadius: 100 }}>
                    {stage.label}
                  </span>
                  {/* Context menu */}
                  <div style={{ position: 'relative' }} ref={menuOpen === p.id ? menuRef : undefined}>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: '2px 4px', borderRadius: 6, display: 'flex', opacity: deleting === p.id ? 0.4 : 1 }}
                    >
                      {deleting === p.id
                        ? <div style={{ width: 14, height: 14, border: '2px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        : <MoreHorizontal size={16} />}
                    </button>
                    {menuOpen === p.id && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '4px', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                        <button
                          onClick={e => { e.stopPropagation(); navigate({ to: '/analysis/$projectId', params: { projectId: p.id } }) }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', color: c.textPrimary, fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.background = c.isDark ? 'oklch(0.22 0.004 270)' : '#f3f4f6')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <ExternalLink size={13} /> Open analysis
                        </button>
                        <div style={{ height: 1, background: c.border, margin: '2px 4px' }} />
                        <button
                          onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${p.name}"? This cannot be undone.`)) deleteProject(p.id) }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', color: 'oklch(0.65 0.18 25)', fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.65 0.18 25/0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <Trash2 size={13} /> Delete project
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{p.name}</h3>
                <p style={{ fontSize: 12, color: c.textMuted, margin: '0 0 16px' }}>{timeAgo(p.created_at)}</p>

                {/* Scores or status */}
                {latestAnalysis ? (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <ScoreBox label="C" score={latestAnalysis.concept_score} theme={theme} />
                    <ScoreBox label="S" score={latestAnalysis.spatial_score} theme={theme} />
                    <ScoreBox label="P" score={latestAnalysis.presentation_score} theme={theme} />
                  </div>
                ) : (
                  <div style={{ marginBottom: 14, padding: '12px', borderRadius: 10, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc', border: `1px solid ${c.border}`, textAlign: 'center' }}>
                    {isPending ? (
                      <span style={{ fontSize: 12, color: '#F97316', fontWeight: 600 }}>⏳ Analysis in progress…</span>
                    ) : (
                      <span style={{ fontSize: 12, color: c.textMuted }}>No analysis yet</span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 12, color: c.textMuted }}>{timeAgo(p.created_at)}</span>
                </div>
              </div>
            )
          })}

          {/* New Project Card */}
          <div
            onClick={() => navigate({ to: '/projects/new' })}
            style={{ background: 'transparent', borderRadius: 18, padding: '20px 22px', border: `1.5px dashed ${c.border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 200, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#F97316'; (e.currentTarget as HTMLDivElement).style.background = 'oklch(0.72 0.18 45 / 0.04)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c.border; (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} color="#F97316" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: c.textMuted }}>New project</span>
          </div>
        </div>
      )}

      {!loading && projects.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: c.textMuted }}>
          <p style={{ fontSize: 14 }}>No projects match your search.</p>
        </div>
      )}
    </div>
  )
}
