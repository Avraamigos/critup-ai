import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Upload, FileText, X, Check } from 'lucide-react'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

const STAGES = [
  { v: 'pre-design',       l: 'Pre-Design',       desc: 'Site analysis, program, precedents', emoji: '🔍' },
  { v: 'initial-concept',  l: 'Initial Concept',  desc: 'Diagrams, parti, early massing',     emoji: '💡' },
  { v: 'finalized-design', l: 'Finalized Design', desc: 'Developed drawings, details',         emoji: '📐' },
  { v: 'jury-prep',        l: 'Jury Prep',        desc: 'Presentation boards, final layout',   emoji: '🎯' },
]

const FOCUSES = [
  { v: 'concept', l: 'Concept strength' },
  { v: 'spatial', l: 'Spatial logic' },
  { v: 'presentation', l: 'Presentation clarity' },
  { v: 'jury', l: 'Jury questions' },
  { v: 'all', l: 'Full analysis' },
]

export function NewProjectPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: '', stage: '', focuses: [] as string[], file: null as File | null })
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalSteps = 4
  const canNext = [
    !!form.name.trim(),
    !!form.stage,
    form.focuses.length > 0,
    !!form.file,
  ][step]

  const toggleFocus = (v: string) => {
    setForm(f => ({
      ...f,
      focuses: f.focuses.includes(v) ? f.focuses.filter(x => x !== v) : [...f.focuses, v],
    }))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') setForm(f => ({ ...f, file }))
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setForm(f => ({ ...f, file }))
  }

  // Wrap a thenable (incl. PostgrestBuilder) with a timeout so we never hang forever
  function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out. Check your connection and try again.`)), ms)
      ),
    ])
  }

  const goNext = async () => {
    if (!canNext || saving) return
    if (step < totalSteps - 1) { setStep(s => s + 1); return }

    // Final step — save everything
    setError(null)
    setUploadStatus(null)
    if (!user) { setError('You must be signed in. Please refresh and log in again.'); return }
    if (!form.file) { setError('Please select a PDF file.'); return }
    setSaving(true)

    try {
      // 1. Create project row
      setUploadStatus('Creating project…')
      const projectInsert = {
        user_id:     user.id,
        name:        form.name.trim(),
        stage:       form.stage as import('@/lib/database.types').ProjectStage,
        focus_areas: form.focuses,
      }
      const { data: project, error: projErr } = await withTimeout(
        supabase.from('projects').insert(projectInsert).select('id, name').single(),
        15_000, 'Creating project'
      )
      if (projErr || !project) throw new Error(projErr?.message ?? 'Failed to create project')

      // 2. Upload PDF to Storage (large file — 60 s)
      setUploadStatus(`Uploading ${form.file.name}…`)
      const pdfPath = `${user.id}/${project.id}/${Date.now()}_${form.file!.name}`
      const { error: uploadErr } = await withTimeout(
        supabase.storage.from('project-pdfs').upload(pdfPath, form.file!, { cacheControl: '3600', upsert: false }),
        60_000, 'Uploading PDF'
      )
      if (uploadErr) throw new Error(uploadErr.message)

      // 3. Create analysis row (status: pending — AI will fill it)
      setUploadStatus('Saving analysis record…')
      const analysisInsert = {
        project_id: project.id,
        user_id:    user.id,
        status:     'pending' as import('@/lib/database.types').AnalysisStatus,
        pdf_path:   pdfPath,
      }
      const { data: analysis, error: analysisErr } = await withTimeout(
        supabase.from('analyses').insert(analysisInsert).select('id').single(),
        15_000, 'Saving analysis'
      )
      if (analysisErr || !analysis) throw new Error(analysisErr?.message ?? 'Failed to create analysis')

      // 4. Trigger AI analysis (fire and forget — analysis page polls for completion)
      setUploadStatus('Starting AI analysis…')
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: (analysis as unknown as { id: string }).id }),
      }).catch(console.error)

      navigate({ to: '/analysis/$projectId', params: { projectId: project.id } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
      setUploadStatus(null)
    }
  }

  const goBack = () => {
    if (step === 0) { navigate({ to: '/projects' }); return }
    setStep(s => s - 1)
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Inter',sans-serif", color: c.textPrimary, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      {/* Progress bar */}
      <div style={{ height: 3, background: c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <div style={{ height: '100%', background: '#F97316', width: `${((step + 1) / totalSteps) * 100}%`, transition: 'width 0.4s ease', boxShadow: '0 0 8px oklch(0.72 0.18 45 / 0.6)', borderRadius: 100 }} />
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', padding: '72px 24px 48px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: '4px 8px', borderRadius: 8 }}>
            <ArrowLeft size={16} color={c.textMuted} /> Back
          </button>
          <span style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Step {step + 1} of {totalSteps}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CritupLogo size={18} showText={false} theme={theme} />
            <button
              onClick={async () => { await signOut(); navigate({ to: '/landing' }) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 12, padding: '4px 8px', borderRadius: 6, opacity: 0.6 }}
            >Sign out</button>
          </div>
        </div>

        {/* Step 1: Project name */}
        {step === 0 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>What's your project called?</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>Give it a short name you'll recognize</p>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && goNext()}
              placeholder="e.g. Riverside Cultural Pavilion"
              autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, boxSizing: 'border-box', background: c.cardBg, border: `1.5px solid ${form.name ? '#F97316' : c.border}`, color: c.textPrimary, fontSize: 16, outline: 'none', fontFamily: "'Inter',sans-serif" }}
              onFocus={e => e.target.style.borderColor = '#F97316'}
              onBlur={e => e.target.style.borderColor = form.name ? '#F97316' : c.border}
            />
          </>
        )}

        {/* Step 2: Design stage */}
        {step === 1 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>What stage is your design in?</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>This helps the AI calibrate its critique appropriately</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {STAGES.map(s => (
                <button key={s.v} onClick={() => setForm(f => ({ ...f, stage: s.v }))} style={{
                  padding: '16px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                  background: form.stage === s.v ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.1)' : '#fff7ed') : c.cardBg,
                  border: form.stage === s.v ? '1.5px solid #F97316' : `1px solid ${c.border}`,
                  boxShadow: form.stage === s.v ? '0 0 20px oklch(0.72 0.18 45 / 0.12)' : 'none',
                  position: 'relative',
                }}>
                  {form.stage === s.v && (
                    <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: form.stage === s.v ? '#F97316' : c.textPrimary, marginBottom: 3 }}>{s.l}</div>
                  <div style={{ fontSize: 12, color: c.textMuted }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Focus areas */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>What should the AI focus on?</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>Select all that apply</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FOCUSES.map(f => {
                const sel = form.focuses.includes(f.v)
                return (
                  <button key={f.v} onClick={() => toggleFocus(f.v)} style={{
                    padding: '14px 16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                    background: sel ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.1)' : '#fff7ed') : c.cardBg,
                    border: sel ? '1.5px solid #F97316' : `1px solid ${c.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: sel ? '#F97316' : c.textPrimary }}>{f.l}</span>
                    {sel && <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </div>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Step 4: Upload PDF */}
        {step === 3 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>Upload your drawings</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>PDF only · up to 10 pages · max 50 MB</p>

            {!form.file ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${dragging ? '#F97316' : c.border}`, borderRadius: 16, padding: '48px 24px',
                  textAlign: 'center', background: dragging ? 'oklch(0.72 0.18 45 / 0.04)' : c.cardBg,
                  transition: 'all 0.15s', cursor: 'pointer',
                }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Upload size={22} color="#F97316" />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, margin: '0 0 6px' }}>Drop your PDF here</p>
                <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>or click to browse</p>
                <input id="file-input" type="file" accept=".pdf" onChange={onFileChange} style={{ display: 'none' }} />
              </div>
            ) : (
              <div style={{ background: c.cardBg, border: `1.5px solid oklch(0.72 0.17 145)`, borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'oklch(0.72 0.17 145 / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={20} color="oklch(0.72 0.17 145)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.file.name}</p>
                  <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>{(form.file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, file: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div style={{ marginTop: 'auto', paddingTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'oklch(0.65 0.18 25 / 0.1)', border: '1px solid oklch(0.65 0.18 25 / 0.3)', borderRadius: 10, padding: '10px 14px', maxWidth: 360 }}>
              <p style={{ fontSize: 13, color: 'oklch(0.65 0.18 25)', margin: 0, flex: 1 }}>{error}</p>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.65 0.18 25)', padding: 0, flexShrink: 0, lineHeight: 1 }}>✕</button>
            </div>
          )}
          {saving && uploadStatus && (
            <p style={{ fontSize: 12, color: c.textMuted, margin: 0, textAlign: 'right' }}>{uploadStatus}</p>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saving && (
              <button
                onClick={() => { setSaving(false); setUploadStatus(null); setError('Upload cancelled.') }}
                style={{ padding: '12px 20px', borderRadius: 100, background: 'none', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              >Cancel</button>
            )}
            <button onClick={goNext} disabled={saving} style={{
              padding: '12px 32px', borderRadius: 100,
              background: (canNext && !saving) ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'),
              border: 'none', color: (canNext && !saving) ? '#fff' : c.textMuted, fontSize: 15, fontWeight: 600,
              cursor: (canNext && !saving) ? 'pointer' : 'not-allowed', opacity: 1,
              boxShadow: (canNext && !saving) ? '0 0 18px oklch(0.72 0.18 45 / 0.35)' : 'none', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {saving && (
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin-btn 0.7s linear infinite' }} />
              )}
              {saving ? 'Uploading…' : step === totalSteps - 1 ? 'Analyse project →' : 'Next →'}
            </button>
          </div>
          <style>{`@keyframes spin-btn { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  )
}
