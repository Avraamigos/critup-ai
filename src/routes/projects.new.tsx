import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Upload, FileText, X, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { track } from '@/lib/analytics'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

const STAGES = [
  { v: 'pre-design',       descKey: 'newProject.stageDescPreDesign', emoji: '🔍' },
  { v: 'initial-concept',  descKey: 'newProject.stageDescInitial',   emoji: '💡' },
  { v: 'finalized-design', descKey: 'newProject.stageDescFinalized', emoji: '📐' },
  { v: 'jury-prep',        descKey: 'newProject.stageDescJury',      emoji: '🎯' },
]

const FOCUSES = [
  { v: 'concept', lKey: 'newProject.focusConcept' },
  { v: 'spatial', lKey: 'newProject.focusSpatial' },
  { v: 'presentation', lKey: 'newProject.focusPresentation' },
  { v: 'jury', lKey: 'newProject.focusJury' },
  { v: 'all', lKey: 'newProject.focusAll' },
]

export function NewProjectPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: '', discipline: '', stage: '', focuses: [] as string[], briefText: '', file: null as File | null })
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [briefPdfLoading, setBriefPdfLoading] = useState(false)
  const briefPdfRef = useRef<HTMLInputElement>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageCountError, setPageCountError] = useState<string | null>(null)
  const [pageCountIsError, setPageCountIsError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFreeUser = !profile || profile.plan === 'free'
  const PAGE_LIMIT = 50
  const COMPRESS_THRESHOLD_MB = 10 // compress if over this size
  const API_SAFE_MB = 20 // base64 adds 33% — keep binary under 20MB so encoded stays under 27MB
  const MAX_SIZE_MB = 150 // silent hard cap — browser memory protection

  // Compress a PDF by re-rendering each page as JPEG at reduced DPI
  // scale: 1.0 = 72 DPI, 1.2 = 86 DPI, 1.5 = 108 DPI
  // maxWidth caps the longest page edge in pixels — prevents OOM on large-format
  // architecture sheets regardless of the PDF's original DPI or page size.
  const compressPdf = async (file: File, onProgress: (progress: string) => void, maxWidth = 1400, quality = 0.82): Promise<File> => {
    const buf = await file.arrayBuffer()
    const lib = await import('pdfjs-dist')
    lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`
    const pdfDoc = await lib.getDocument({ data: new Uint8Array(buf) }).promise
    const numPages = pdfDoc.numPages

    const { jsPDF } = await import('jspdf')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    let outPdf: InstanceType<typeof jsPDF> | null = null

    for (let i = 1; i <= numPages; i++) {
      onProgress(`${i}/${numPages}`)
      const page = await pdfDoc.getPage(i)
      const base = page.getViewport({ scale: 1 })
      // Fit within maxWidth — shrinks large pages, leaves small pages alone
      const scale = Math.min(maxWidth / base.width, maxWidth / base.height, 2)
      const viewport = page.getViewport({ scale })
      canvas.width  = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      // White background so architectural drawings don't go black under JPEG
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport } as any).promise

      const jpegData = canvas.toDataURL('image/jpeg', quality)
      const imgW = canvas.width  * 0.264583 // px → mm (72 dpi base)
      const imgH = canvas.height * 0.264583

      if (!outPdf) {
        outPdf = new jsPDF({ orientation: imgW > imgH ? 'landscape' : 'portrait', unit: 'mm', format: [imgW, imgH] })
      } else {
        outPdf.addPage([imgW, imgH], imgW > imgH ? 'landscape' : 'portrait')
      }
      outPdf.addImage(jpegData, 'JPEG', 0, 0, imgW, imgH, undefined, 'FAST')
    }

    const blob = outPdf!.output('blob')
    return new File([blob], file.name, { type: 'application/pdf' })
  }

  const validateAndSetFile = useCallback(async (file: File) => {
    setPageCountError(null)
    setPageCountIsError(false)
    if (!file || file.type !== 'application/pdf') return

    let finalFile = file

    // Auto-compress large PDFs to stay under Anthropic's API limit
    // Base64 adds 33%, so we need binary under ~20MB → base64 ~27MB (well under 32MB API cap)
    if (file.size > COMPRESS_THRESHOLD_MB * 1024 * 1024) {
      try {
        setPageCountIsError(false)
        setPageCountError(t('newProject.compressing', { progress: '0/?' }))
        // Pass 1: generous quality, max 1400px edge
        finalFile = await compressPdf(file, (progress) => setPageCountError(t('newProject.compressing', { progress })), 1400, 0.82)

        // Pass 2: if still over safe limit, shrink further
        if (finalFile.size > API_SAFE_MB * 1024 * 1024) {
          setPageCountError(t('newProject.stillLarge'))
          finalFile = await compressPdf(file, (progress) => setPageCountError(t('newProject.compressing', { progress })), 1000, 0.72)
        }

        // Pass 3: last resort — aggressive
        if (finalFile.size > API_SAFE_MB * 1024 * 1024) {
          setPageCountError(t('newProject.finalPass'))
          finalFile = await compressPdf(file, (progress) => setPageCountError(t('newProject.compressing', { progress })), 800, 0.62)
        }

        setPageCountError(null)

        if (finalFile.size > MAX_SIZE_MB * 1024 * 1024) {
          setPageCountIsError(true)
          setPageCountError(t('newProject.tooLargeAfter'))
          return
        }
      } catch (compressErr) {
        console.error('PDF compression error:', compressErr)
        // Never silently upload an oversized file — block it and tell the user
        if (file.size > API_SAFE_MB * 1024 * 1024) {
          setPageCountIsError(true)
          setPageCountError(t('newProject.couldNotCompress'))
          return
        }
        setPageCountError(null)
        finalFile = file
      }
    }

    try {
      const buf = await finalFile.arrayBuffer()
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`
      const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise
      if (pdf.numPages > PAGE_LIMIT) {
        setPageCountIsError(true)
        setPageCountError(t('newProject.pageCountOver', { pages: pdf.numPages, limit: PAGE_LIMIT }))
        return
      }
    } catch {
      // can't read page count — let it through
    }
    setForm(f => ({ ...f, file: finalFile }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PAGE_LIMIT])

  const totalSteps = 6
  const canNext = [
    !!form.name.trim(),
    !!form.stage,
    form.focuses.length > 0,
    true,          // brief is optional — always allow skip
    !!form.file,
    true,          // confirmation step
  ][step]

  const toggleFocus = (v: string) => {
    setForm(f => ({
      ...f,
      focuses: f.focuses.includes(v) ? f.focuses.filter(x => x !== v) : [...f.focuses, v],
    }))
  }

  const handleBriefPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBriefPdfLoading(true)
    setError(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`
      const loadingTask = lib.getDocument({ data: uint8Array, useSystemFonts: true })
      const pdf = await loadingTask.promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const stream = page.streamTextContent({ includeMarkedContent: false })
        const reader = stream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          text += (value as any).items.map((item: any) => ('str' in item ? item.str : '')).join(' ') + ' '
        }
        text += '\n'
      }
      const cleaned = text.replace(/\s{3,}/g, '\n\n').trim()
      if (!cleaned) {
        setError(t('newProject.extractFailNoText'))
      } else {
        setForm(f => ({ ...f, briefText: cleaned }))
      }
    } catch (err) {
      console.error('Brief PDF parse error:', err)
      setError(t('newProject.readPdfFail', { msg: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBriefPdfLoading(false)
      if (briefPdfRef.current) briefPdfRef.current.value = ''
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) validateAndSetFile(file)
  }, [validateAndSetFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSetFile(file)
  }

  // Wait for profile to load before rendering — profile arrives async after auth resolves,
  // so without this check the wizard flashes briefly with analyses_used=0 and the wall never triggers.
  if (user && !profile) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const isFree = !profile || profile.plan === 'free'
  const analysesUsed = (profile as { analyses_used?: number } | null)?.analyses_used ?? 0

  if (isFree && analysesUsed >= 1) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
        <DotGrid theme={theme} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <CritupLogo size={40} />
          </div>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>
            {t('newProject.paywallTitle')}
          </h1>
          <p style={{ fontSize: 15, color: c.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
            {t('newProject.paywallBodyPre')}<strong style={{ color: c.textPrimary }}>{t('newProject.paywallBodyBold')}</strong>{t('newProject.paywallBodyPost')}
          </p>
          <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, padding: '24px 28px', marginBottom: 28, textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>{t('newProject.proIncludes')}</p>
            {[
              ['📊', t('newProject.proFeat1')],
              ['💬', t('newProject.proFeat2')],
              ['⚖️', t('newProject.proFeat3')],
              ['📄', t('newProject.proFeat4')],
            ].map(([icon, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 14, color: c.textPrimary }}>{label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => window.location.href = '/pricing'}
            style={{ display: 'block', width: '100%', padding: '14px 0', borderRadius: 12, background: '#F97316', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', marginBottom: 16, transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {t('newProject.upgradeToPro')}
          </button>
          <button
            onClick={() => navigate({ to: '/' })}
            style={{ background: 'none', border: 'none', color: c.textMuted, fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {t('newProject.backToDashboard')}
          </button>
        </div>
      </div>
    )
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
    if (!user) { setError(t('newProject.errSignedIn')); return }
    if (!form.file) { setError(t('newProject.errSelectPdf')); return }
    setSaving(true)

    try {
      // 1. Create project row
      setUploadStatus(t('newProject.statusCreating'))
      const projectInsert = {
        user_id:     user.id,
        name:        form.name.trim(),
        stage:       form.stage as import('@/lib/database.types').ProjectStage,
        discipline:  ({ arch: 'architecture', architecture: 'architecture', interior: 'interior', urban: 'urban' } as Record<string, string>)[profile?.discipline ?? ''] as 'architecture' | 'interior' | 'urban' | null ?? null,
        focus_areas: form.focuses,
        brief_text:  form.briefText.trim() || null,
      }
      const { data: project, error: projErr } = await withTimeout(
        supabase.from('projects').insert(projectInsert).select('id, name').single(),
        15_000, 'Creating project'
      )
      if (projErr || !project) throw new Error(projErr?.message ?? t('newProject.errCreateProject'))

      // 2. Upload PDF to Storage (large file — 60 s)
      setUploadStatus(t('newProject.statusUploading', { name: form.file.name }))
      const pdfPath = `${user.id}/${project.id}/${Date.now()}_${form.file!.name}`
      const { error: uploadErr } = await withTimeout(
        supabase.storage.from('project-pdfs').upload(pdfPath, form.file!, { cacheControl: '3600', upsert: false }),
        60_000, 'Uploading PDF'
      )
      if (uploadErr) throw new Error(uploadErr.message)

      // 3. Create analysis row (status: pending — AI will fill it)
      setUploadStatus(t('newProject.statusSavingAnalysis'))
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
      if (analysisErr || !analysis) throw new Error(analysisErr?.message ?? t('newProject.errCreateAnalysis'))

      // 4. Trigger AI analysis (fire and forget — analysis page polls for completion)
      setUploadStatus(t('newProject.statusStartingAi'))
      const analysisRowId = (analysis as unknown as { id: string }).id
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: analysisRowId }),
      }).catch(console.error)

      // Make this the active project for Crit chat context immediately
      localStorage.setItem('critup_last_analysis_id', analysisRowId)
      localStorage.setItem('critup_last_project_id', project.id)
      localStorage.setItem('critup_last_project_name', form.name.trim())

      track.analysisCreated(project.id)
      navigate({ to: '/analysis/$projectId', params: { projectId: project.id } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('newProject.errGeneric'))
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
            <ArrowLeft size={16} color={c.textMuted} /> {t('onboarding.back')}
          </button>
          <span style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>{t('onboarding.stepOf', { n: step + 1, total: totalSteps })}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CritupLogo size={18} showText={false} theme={theme} />
            <button
              onClick={() => { signOut(); navigate({ to: '/landing' }) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 12, padding: '4px 8px', borderRadius: 6, opacity: 0.6 }}
            >{t('nav.signOut')}</button>
          </div>
        </div>

        {/* Step 1: Project name */}
        {step === 0 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{t('newProject.step1Title')}</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>{t('newProject.step1Sub')}</p>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && goNext()}
              placeholder={t('newProject.step1Placeholder')}
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
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{t('newProject.step2Title')}</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>{t('newProject.step2Sub')}</p>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: form.stage === s.v ? '#F97316' : c.textPrimary, marginBottom: 3 }}>{t(`stages.${s.v}`)}</div>
                  <div style={{ fontSize: 12, color: c.textMuted }}>{t(s.descKey)}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Focus areas */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{t('newProject.step3Title')}</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>{t('onboarding.selectAll')}</p>
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
                    <span style={{ fontSize: 14, fontWeight: 600, color: sel ? '#F97316' : c.textPrimary }}>{t(f.lKey)}</span>
                    {sel && <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </div>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Step 4: Course Brief / Outline (optional) */}
        {step === 3 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>
              {t('newProject.step4Title')}
            </h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 6 }}>
              {t('newProject.step4Sub')}
            </p>
            <div style={{ fontSize: 12, color: '#F97316', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />
              {t('newProject.step4Hint')}
            </div>

            {/* PDF upload option */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => briefPdfRef.current?.click()}
                disabled={briefPdfLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: briefPdfLoading ? c.textMuted : c.textPrimary, fontSize: 12, fontWeight: 600, cursor: briefPdfLoading ? 'default' : 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!briefPdfLoading) { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textPrimary }}
              >
                {briefPdfLoading
                  ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> {t('newProject.extracting')}</>
                  : <><FileText size={13} /> {t('newProject.uploadBriefPdf')}</>
                }
              </button>
              <input ref={briefPdfRef} type="file" accept=".pdf" onChange={handleBriefPdf} style={{ display: 'none' }} />
              <span style={{ fontSize: 12, color: c.textMuted }}>{t('newProject.orPasteBelow')}</span>
            </div>

            <div style={{ position: 'relative' }}>
              <textarea
                value={form.briefText}
                onChange={e => setForm(f => ({ ...f, briefText: e.target.value }))}
                placeholder={t('newProject.briefPlaceholder')}
                rows={11}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '14px 16px', borderRadius: 12,
                  background: c.cardBg, border: `1.5px solid ${form.briefText ? '#F97316' : c.border}`,
                  color: c.textPrimary, fontSize: 13, lineHeight: 1.65, resize: 'vertical',
                  outline: 'none', fontFamily: "'Inter', sans-serif",
                }}
                onFocus={e => (e.target.style.borderColor = '#F97316')}
                onBlur={e => (e.target.style.borderColor = form.briefText ? '#F97316' : c.border)}
              />
              {form.briefText && (
                <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 11, color: c.textMuted }}>
                  {t('newProject.charsSuffix', { count: form.briefText.length })}
                </div>
              )}
            </div>
            <button
              onClick={() => setStep(s => s + 1)}
              style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 13, padding: 0, textDecoration: 'underline' }}
            >
              {t('newProject.skipBrief')}
            </button>
          </>
        )}

        {/* Step 5: Upload PDF */}
        {step === 4 && (
          <>
            <style>{`
              @keyframes upload-float { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-6px); } }
              @keyframes upload-glow  { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
              @keyframes upload-spin  { to { transform:rotate(360deg); } }
              .upload-zone:hover .upload-icon-ring { transform:scale(1.07); }
            `}</style>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{t('newProject.step5Title')}</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 32 }}>{t('newProject.step5Sub', { limit: PAGE_LIMIT })}</p>

            {!form.file && (
              <div
                className="upload-zone"
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('file-input')?.click()}
                style={{
                  position: 'relative', borderRadius: 20, padding: '52px 24px 44px',
                  textAlign: 'center', cursor: 'pointer', overflow: 'hidden',
                  background: dragging
                    ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.08)' : '#fff7ed')
                    : c.cardBg,
                  border: `2px dashed ${dragging ? '#F97316' : (c.isDark ? 'oklch(0.32 0.008 270)' : '#d1d5db')}`,
                  transition: 'all 0.2s',
                  boxShadow: dragging ? '0 0 0 4px oklch(0.72 0.18 45/0.12), inset 0 0 40px oklch(0.72 0.18 45/0.04)' : 'none',
                }}
              >
                {/* Ambient glow */}
                <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 200, height: 200, background: 'radial-gradient(circle, oklch(0.72 0.18 45/0.09) 0%, transparent 70%)', pointerEvents: 'none', animation: 'upload-glow 3s ease-in-out infinite' }} />

                {/* Floating icon */}
                <div
                  className="upload-icon-ring"
                  style={{
                    width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
                    background: dragging
                      ? 'linear-gradient(135deg, oklch(0.72 0.18 45/0.25), oklch(0.72 0.18 45/0.1))'
                      : (c.isDark ? 'oklch(0.22 0.008 270)' : '#f3f4f6'),
                    border: `1.5px solid ${dragging ? '#F97316' : (c.isDark ? 'oklch(0.3 0.008 270)' : '#e5e7eb')}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: dragging ? '0 0 28px oklch(0.72 0.18 45/0.3)' : '0 4px 16px rgba(0,0,0,0.08)',
                    animation: 'upload-float 3s ease-in-out infinite',
                    transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                    position: 'relative',
                  }}
                >
                  <Upload size={26} color={dragging ? '#F97316' : (c.isDark ? 'oklch(0.6 0.005 270)' : '#9ca3af')} strokeWidth={1.8} />
                </div>

                <p style={{ fontSize: 16, fontWeight: 700, color: dragging ? '#F97316' : c.textPrimary, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                  {dragging ? t('newProject.dropIt') : t('newProject.dropHere')}
                </p>
                <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 24px', lineHeight: 1.5 }}>
                  {t('newProject.orText')}
                  <span style={{ color: '#F97316', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                    {t('newProject.clickToBrowse')}
                  </span>
                </p>

                {/* Badges row */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[['📄', t('newProject.badgePdfOnly')], ['📑', t('newProject.badgeUpToPages', { limit: PAGE_LIMIT })], ['✨', t('newProject.badgeAnySize')]].map(([icon, label]) => (
                    <div key={label} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 11px', borderRadius: 100,
                      background: c.isDark ? 'oklch(0.21 0.006 270)' : '#f9fafb',
                      border: `1px solid ${c.isDark ? 'oklch(0.28 0.006 270)' : '#e5e7eb'}`,
                      fontSize: 11, color: c.textMuted, fontWeight: 500,
                    }}>
                      <span style={{ fontSize: 12 }}>{icon}</span>
                      {label}
                    </div>
                  ))}
                </div>

                <input id="file-input" type="file" accept=".pdf" onChange={onFileChange} style={{ display: 'none' }} />
              </div>
            )}

            {/* Compression progress / page-count error.
                "Compressing…" / "compressing further" / "compression pass" are progress, not errors —
                show them with a spinner and neutral styling so users know the wait is intentional. */}
            {pageCountError && (() => {
              const isProgress = !pageCountIsError
              return (
                <div style={{
                  marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: isProgress
                    ? (c.isDark ? 'oklch(0.20 0.01 270)' : '#f8fafc')
                    : (c.isDark ? 'oklch(0.18 0.06 30/0.6)' : '#fff7ed'),
                  border: isProgress
                    ? `1.5px solid ${c.border}`
                    : '1.5px solid oklch(0.72 0.18 45/0.5)',
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
                  {isProgress
                    ? <Loader2 size={16} color="#F97316" style={{ flexShrink: 0, marginTop: 1, animation: 'spin 1s linear infinite' }} />
                    : <AlertTriangle size={16} color="#F97316" style={{ flexShrink: 0, marginTop: 1 }} />}
                  <p style={{ margin: 0, fontSize: 13, color: c.textPrimary, lineHeight: 1.5 }}>
                    {isProgress ? <>{pageCountError}<br /><span style={{ fontSize: 12, color: c.textMuted }}>{t('newProject.compressNote')}</span></> : pageCountError}
                  </p>
                </div>
              )
            })()}

            {/* Selected file preview */}
            {!pageCountError && form.file && (
              <div style={{ background: c.isDark ? 'oklch(0.17 0.01 145/0.6)' : '#f0fdf4', border: `1.5px solid oklch(0.72 0.17 145 / 0.5)`, borderRadius: 18, padding: '22px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 0 24px oklch(0.72 0.17 145/0.1)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'oklch(0.72 0.17 145 / 0.15)', border: '1px solid oklch(0.72 0.17 145/0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={24} color="oklch(0.65 0.17 145)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.65 0.17 145)', letterSpacing: '0.07em', marginBottom: 4, textTransform: 'uppercase' }}>{t('newProject.pdfReady')}</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.file.name}</p>
                  <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>{(form.file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, file: null }))} style={{ background: c.isDark ? 'oklch(0.25 0.006 270)' : '#e5e7eb', border: 'none', cursor: 'pointer', color: c.textMuted, padding: '6px', borderRadius: 8, display: 'flex', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = c.isDark ? 'oklch(0.3 0.006 270)' : '#d1d5db')}
                  onMouseLeave={e => (e.currentTarget.style.background = c.isDark ? 'oklch(0.25 0.006 270)' : '#e5e7eb')}
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Step 6: Confirm before upload */}
        {step === 5 && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{t('newProject.step6Title')}</h1>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 28 }}>{t('newProject.step6Sub')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Project name */}
              <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 18px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 3 }}>{t('newProject.labelProjectName')}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{form.name}</div>
                </div>
                <button onClick={() => setStep(0)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>{t('newProject.edit')}</button>
              </div>

              {/* Stage */}
              <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 18px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 3 }}>{t('newProject.labelDesignStage')}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{form.stage ? t(`stages.${form.stage}`) : ''}</div>
                </div>
                <button onClick={() => setStep(1)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>{t('newProject.edit')}</button>
              </div>

              {/* Focus areas */}
              <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 18px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 6 }}>{t('newProject.labelFocusAreas')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {form.focuses.map(f => {
                      const fk = FOCUSES.find(x => x.v === f)?.lKey
                      return (
                      <span key={f} style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'oklch(0.72 0.18 45 / 0.1)', color: '#F97316', border: '1px solid oklch(0.72 0.18 45 / 0.3)' }}>
                        {fk ? t(fk) : f}
                      </span>
                      )
                    })}
                  </div>
                </div>
                <button onClick={() => setStep(2)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', color: c.textMuted, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>{t('newProject.edit')}</button>
              </div>

              {/* Brief */}
              <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 18px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 4 }}>{t('newProject.labelCourseBrief')}</div>
                  {form.briefText.trim() ? (
                    <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                      {form.briefText.trim()}
                    </p>
                  ) : (
                    <span style={{ fontSize: 13, color: c.textMuted, fontStyle: 'italic' }}>{t('newProject.noBriefAdded')}</span>
                  )}
                </div>
                <button onClick={() => setStep(3)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', color: c.textMuted, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>{t('newProject.edit')}</button>
              </div>

              {/* PDF */}
              <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 18px', border: `1.5px solid oklch(0.72 0.17 145 / 0.6)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, marginRight: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'oklch(0.72 0.17 145 / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={17} color="oklch(0.72 0.17 145)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 2 }}>{t('newProject.labelPdfFile')}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.file?.name}</div>
                    <div style={{ fontSize: 12, color: c.textMuted }}>{form.file ? (form.file.size / 1024 / 1024).toFixed(1) + ' MB' : ''}</div>
                  </div>
                </div>
                <button onClick={() => setStep(4)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', color: c.textMuted, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>{t('newProject.change')}</button>
              </div>
            </div>

            {/* Warning */}
            <div style={{ display: 'flex', gap: 10, background: 'oklch(0.72 0.18 45 / 0.07)', border: '1px solid oklch(0.72 0.18 45 / 0.25)', borderRadius: 12, padding: '12px 14px', marginTop: 16 }}>
              <AlertTriangle size={15} color="#F97316" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: c.textMuted, margin: 0, lineHeight: 1.5 }}>
                {t('newProject.warningPre')}<strong style={{ color: c.textPrimary }}>{t('newProject.warningBold')}</strong>{t('newProject.warningPost')}
              </p>
            </div>
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
                onClick={() => { setSaving(false); setUploadStatus(null); setError(t('newProject.errCancelled')) }}
                style={{ padding: '12px 20px', borderRadius: 100, background: 'none', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              >{t('common.cancel')}</button>
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
              {saving ? t('newProject.uploading') : step === totalSteps - 1 ? t('newProject.startAnalysis') : t('onboarding.next')}
            </button>
          </div>
          <style>{`@keyframes spin-btn { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  )
}
