import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Upload, Loader2, Download, RotateCcw, Sparkles, Lock, ImageIcon, X } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { useIsMobile } from '@/lib/useIsMobile'
import { useAuth } from '@/lib/auth'
import { useNavigate } from '@tanstack/react-router'
import { MONO } from '@/lib/fonts'
import {
  uploadPosterInput, getPosterCredits, generatePoster,
  type PosterFormat,
} from '@/lib/poster'

const TEMPLATES = [
  { id: 'bluehour', name: 'Blue Hour', desc: 'Cinematic dusk, warm glow', swatch: 'linear-gradient(160deg,#1b3a5c,#0d1b2a)' },
  { id: 'minimal',  name: 'Minimal',   desc: 'Swiss, daylight, calm air', swatch: 'linear-gradient(160deg,#e8e6df,#c9c6bd)' },
  { id: 'dramatic', name: 'Dramatic',  desc: 'High contrast, moody',      swatch: 'linear-gradient(160deg,#2a2a2e,#0a0a0b)' },
  { id: 'warm',     name: 'Golden',    desc: 'Sunset, long shadows',      swatch: 'linear-gradient(160deg,#caa06a,#7a4a22)' },
]

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

export function PosterToolPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const isMobile = useIsMobile()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  // Optional deep-link from the analysis page: /tools/poster?analysisId=…
  const search = useSearch({ strict: false }) as { analysisId?: string }
  const isPro = !!profile && profile.plan !== 'free'

  const [template, setTemplate] = useState('bluehour')
  const [format, setFormat] = useState<PosterFormat>('vertical')
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [planFiles, setPlanFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [credits, setCredits] = useState<{ used: number; limit: number; remaining: number } | null>(null)

  useEffect(() => { if (isPro) getPosterCredits().then(setCredits).catch(() => {}) }, [isPro])

  // ── Pro gate ────────────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'oklch(0.72 0.18 45/0.12)', border: '1px solid oklch(0.72 0.18 45/0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Lock size={22} color={c.orange} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, margin: '0 0 8px', letterSpacing: '-0.03em' }}>Poster tool is a Pro feature</h1>
          <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6, margin: '0 0 22px' }}>Turn your building render into a polished presentation title slide in seconds. Upgrade to unlock it.</p>
          <button onClick={() => navigate({ to: '/pricing' })} style={{ padding: '11px 24px', borderRadius: 100, background: c.orange, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 18px oklch(0.72 0.18 45/0.35)' }}>Upgrade to Pro</button>
        </div>
      </div>
    )
  }

  const generate = async () => {
    if (!user || !heroFile || busy) return
    setBusy(true); setError(null); setResultUrl(null)
    try {
      const heroPath = await uploadPosterInput(user.id, heroFile)
      const planPaths: string[] = []
      for (const f of planFiles.slice(0, 3)) planPaths.push(await uploadPosterInput(user.id, f))
      const r = await generatePoster({
        format, template, heroPath, planPaths,
        titleHint: title || undefined,
        analysisId: search?.analysisId ?? null,
      })
      if (r.error) { setError(r.message || 'Generation failed. Please try again.'); return }
      if (r.url) setResultUrl(r.url)
      if (typeof r.remaining === 'number') setCredits(cr => cr ? { ...cr, remaining: r.remaining, used: cr.limit - r.remaining } : cr)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const card: React.CSSProperties = { background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, padding: 20 }
  const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted, marginBottom: 10, display: 'block' }
  const aspect = format === 'vertical' ? 2 / 3 : 3 / 2

  return (
    <div style={{ padding: isMobile ? '20px 16px 60px' : '28px 32px 60px', maxWidth: 1080, margin: '0 auto', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <Sparkles size={18} color={c.orange} />
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: 0 }}>Title Poster</h1>
          </div>
          <p style={{ fontSize: 13.5, color: c.textMuted, margin: 0, maxWidth: 60 + 'ch', lineHeight: 1.5 }}>
            Turn your building render into a presentation title slide. Approximate, not final — a strong draft to refine.
          </p>
        </div>
        {credits && (
          <div style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: credits.remaining > 0 ? c.textPrimary : c.red }}>{credits.remaining}</span>
            <span style={{ fontSize: 11, color: c.textMuted }}>of {credits.limit} left this month</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }}>
        {/* ── Left: controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Template */}
          <div style={card}>
            <span style={label}>1 · Vibe</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {TEMPLATES.map(tp => (
                <button key={tp.id} onClick={() => setTemplate(tp.id)} style={{
                  textAlign: 'left', padding: 0, borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
                  background: c.cardBg, border: `1.5px solid ${template === tp.id ? c.orange : c.border}`,
                  boxShadow: template === tp.id ? '0 0 0 3px oklch(0.72 0.18 45/0.12)' : 'none', transition: 'all 0.15s',
                }}>
                  <div style={{ height: 46, background: tp.swatch }} />
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: c.textPrimary }}>{tp.name}</div>
                    <div style={{ fontSize: 10.5, color: c.textMuted }}>{tp.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div style={card}>
            <span style={label}>2 · Format</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['vertical', 'horizontal'] as PosterFormat[]).map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{
                  flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  background: format === f ? 'oklch(0.72 0.18 45/0.08)' : c.cardBg,
                  border: `1.5px solid ${format === f ? c.orange : c.border}`, transition: 'all 0.15s',
                }}>
                  <div style={{ width: f === 'vertical' ? 18 : 28, height: f === 'vertical' ? 28 : 18, borderRadius: 3, border: `2px solid ${format === f ? c.orange : c.textMuted}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, textTransform: 'capitalize' }}>{f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hero upload */}
          <div style={card}>
            <span style={label}>3 · Your building — render or photo</span>
            <UploadZone c={c} file={heroFile} onPick={setHeroFile} hint="A clean render or model screenshot of your building. Higher resolution = better poster." />
            <p style={{ fontSize: 11, color: c.textMuted, marginTop: 8, lineHeight: 1.5 }}>
              Tip: use your best exterior render. The AI keeps your building's geometry and relights it for the chosen vibe.
            </p>
          </div>

          {/* Plans upload (optional) */}
          <div style={card}>
            <span style={label}>4 · Plans / diagrams — optional</span>
            <UploadZone c={c} file={null} onPick={f => setPlanFiles(prev => [...prev, f].slice(0, 3))} hint="Add up to 3 plan cut-outs to inset into the poster (PNG with white/transparent background works best)." compact />
            {planFiles.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {planFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, background: c.inputBg, border: `1px solid ${c.border}`, fontSize: 11, color: c.textMuted }}>
                    <ImageIcon size={12} /> {f.name.slice(-16)}
                    <button onClick={() => setPlanFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: c.textMuted }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title text (for overlay) */}
          <div style={card}>
            <span style={label}>5 · Title text — optional</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project name (e.g. Prime Mall)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, background: c.inputBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 14, fontFamily: FONT, outline: 'none', marginBottom: 8 }} />
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Your name · course · studio (optional)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, background: c.inputBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontFamily: FONT, outline: 'none' }} />
            <p style={{ fontSize: 11, color: c.textMuted, marginTop: 8, lineHeight: 1.5 }}>
              We overlay this as crisp, correct text on top of the image — so names and IDs are never misspelled by the AI.
            </p>
          </div>

          {error && (
            <div style={{ padding: '11px 14px', borderRadius: 10, background: 'oklch(0.65 0.18 25/0.1)', border: '1px solid oklch(0.65 0.18 25/0.3)', color: c.red, fontSize: 13 }}>{error}</div>
          )}

          <button onClick={generate} disabled={!heroFile || busy || (credits?.remaining === 0)} style={{
            padding: '13px', borderRadius: 100, border: 'none',
            background: (!heroFile || busy || credits?.remaining === 0) ? c.border : c.orange,
            color: (!heroFile || busy || credits?.remaining === 0) ? c.textMuted : '#fff',
            fontSize: 14.5, fontWeight: 700, cursor: (!heroFile || busy || credits?.remaining === 0) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: (!heroFile || busy || credits?.remaining === 0) ? 'none' : '0 0 18px oklch(0.72 0.18 45/0.35)',
          }}>
            {busy ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating…</>
              : credits?.remaining === 0 ? 'No generations left this month'
              : resultUrl ? <><RotateCcw size={15} /> Regenerate</> : <><Sparkles size={15} /> Generate poster</>}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>

        {/* ── Right: live preview / result ── */}
        <div style={{ ...card, position: isMobile ? 'static' : 'sticky', top: 20 }}>
          <span style={label}>Preview</span>
          <PosterPreview c={c} aspect={aspect} resultUrl={resultUrl} busy={busy} title={title} subtitle={subtitle} />
          {resultUrl && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <a href={resultUrl} download="critup-poster.png" style={{ flex: 1, padding: '10px', borderRadius: 100, background: c.orange, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Download size={14} /> Download image
              </a>
            </div>
          )}
          <p style={{ fontSize: 10.5, color: c.textMuted, marginTop: 12, lineHeight: 1.5 }}>
            Outputs are AI-generated and approximate. Download the image, then add your final title text over it in any editor if you prefer full control.
          </p>
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UploadZone({ c, file, onPick, hint, compact }: { c: any; file: File | null; onPick: (f: File) => void; hint: string; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onPick(f) }}
      style={{
        border: `1.5px dashed ${drag ? c.orange : c.border}`, borderRadius: 12, padding: compact ? '16px' : '22px 16px',
        textAlign: 'center', cursor: 'pointer', background: drag ? 'oklch(0.72 0.18 45/0.05)' : c.inputBg, transition: 'all 0.15s',
      }}>
      <Upload size={compact ? 16 : 20} color={c.textMuted} style={{ marginBottom: 6 }} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: c.textPrimary }}>{file ? file.name.slice(-30) : 'Drop image or click to browse'}</div>
      {!compact && <div style={{ fontSize: 11, color: c.textMuted, marginTop: 3 }}>{hint}</div>}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f) }} />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PosterPreview({ c, aspect, resultUrl, busy, title, subtitle }: { c: any; aspect: number; resultUrl: string | null; busy: boolean; title: string; subtitle: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: String(aspect), borderRadius: 10, overflow: 'hidden', background: c.inputBg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {resultUrl
        ? <img src={resultUrl} alt="Generated poster" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ textAlign: 'center', color: c.textMuted, padding: 20 }}>
            {busy ? <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} /> : <ImageIcon size={26} />}
            <div style={{ fontSize: 12, marginTop: 8 }}>{busy ? 'Composing your poster…' : 'Your poster will appear here'}</div>
          </div>}
      {/* Editable title overlay preview (real text on top of the image) */}
      {resultUrl && (title || subtitle) && (
        <div style={{ position: 'absolute', top: '6%', left: 0, right: 0, textAlign: 'center', padding: '0 8%', pointerEvents: 'none' }}>
          {title && <div style={{ fontFamily: MONO, color: '#fff', fontWeight: 700, fontSize: 'clamp(14px, 4vw, 22px)', letterSpacing: '0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{title.toUpperCase()}</div>}
          {subtitle && <div style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(8px, 2vw, 11px)', marginTop: 4, textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>{subtitle}</div>}
        </div>
      )}
    </div>
  )
}
