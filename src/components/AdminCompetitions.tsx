import { useEffect, useState } from 'react'
import { Plus, Pencil, Eye, EyeOff, ExternalLink, X } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import type { CompetitionDiscipline, CompetitionLevel } from '@/lib/database.types'

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
  level: CompetitionLevel
  team_required: boolean
  location: string | null
  organizer_url: string | null
  is_active: boolean
  created_at: string
}

type FormState = {
  title: string
  image_url: string
  summary: string
  brief_text: string
  discipline: CompetitionDiscipline
  deadline: string
  registration_deadline: string
  prize: string
  entry_fee: string
  student_eligible: boolean
  level: CompetitionLevel
  team_required: boolean
  location: string
  organizer_url: string
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  title: '', image_url: '', summary: '', brief_text: '',
  discipline: 'architecture', deadline: '', registration_deadline: '',
  prize: '', entry_fee: 'Free', student_eligible: true, level: 'any',
  team_required: false, location: '', organizer_url: '', is_active: true,
}

const DISCIPLINES: CompetitionDiscipline[] = ['architecture', 'interior', 'urban', 'landscape', 'multi']
const LEVELS: CompetitionLevel[] = ['beginner', 'student', 'professional', 'any']

async function getJwt() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

export function AdminCompetitions({ c }: { c: ReturnType<typeof useColors> }) {
  const { error: toastError, success: toastSuccess } = useToast()
  const [comps, setComps] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin-competitions', { headers: { Authorization: `Bearer ${await getJwt()}` } })
      if (!res.ok) throw new Error(await res.text())
      const { competitions } = await res.json()
      setComps(competitions)
    } catch (e) {
      toastError('Failed to load competitions: ' + e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true) }
  const openEdit = (comp: Competition) => {
    setForm({
      title: comp.title, image_url: comp.image_url ?? '', summary: comp.summary ?? '',
      brief_text: comp.brief_text ?? '', discipline: comp.discipline, deadline: comp.deadline,
      registration_deadline: comp.registration_deadline ?? '', prize: comp.prize ?? '',
      entry_fee: comp.entry_fee ?? '', student_eligible: comp.student_eligible, level: comp.level,
      team_required: comp.team_required, location: comp.location ?? '', organizer_url: comp.organizer_url ?? '',
      is_active: comp.is_active,
    })
    setEditId(comp.id)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim() || !form.deadline) { toastError('Title and deadline are required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin-competitions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getJwt()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', id: editId ?? undefined, competition: form }),
      })
      if (!res.ok) throw new Error(await res.text())
      toastSuccess(editId ? 'Competition updated' : 'Competition added')
      setShowForm(false)
      await load()
    } catch (e) {
      toastError('Save failed: ' + e)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (comp: Competition) => {
    setBusyId(comp.id)
    try {
      const res = await fetch('/api/admin-competitions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getJwt()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_active', id: comp.id, is_active: !comp.is_active }),
      })
      if (!res.ok) throw new Error(await res.text())
      setComps(prev => prev.map(x => x.id === comp.id ? { ...x, is_active: !x.is_active } : x))
    } catch (e) {
      toastError('Failed: ' + e)
    } finally {
      setBusyId(null)
    }
  }

  // ── Form field helpers ──
  const labelStyle = { fontSize: 11, fontWeight: 600, color: c.textMuted, marginBottom: 4, display: 'block' } as const
  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${c.border}`,
    background: c.inputBg, color: c.textPrimary, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label style={labelStyle}>{label}</label>{children}</div>
  )
  const text = (key: keyof FormState, label: string, placeholder = '') => (
    <Field label={label}>
      <input
        value={String(form[key])}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={inputStyle}
      />
    </Field>
  )
  const check = (key: keyof FormState, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: c.textPrimary }}>
      <input type="checkbox" checked={Boolean(form[key])} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
      {label}
    </label>
  )

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: c.textMuted }}>
          {comps.length} total · {comps.filter(x => x.is_active).length} active
        </div>
        <button onClick={openNew} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: '#F97316', border: 'none',
          color: '#fff', borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={14} /> Add competition
        </button>
      </div>

      {loading ? (
        <div style={{ color: c.textMuted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>Loading…</div>
      ) : comps.length === 0 ? (
        <div style={{ color: c.textMuted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>No competitions yet. Add the first one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comps.map(comp => (
            <div key={comp.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12,
              opacity: comp.is_active ? 1 : 0.55,
            }}>
              <div style={{ width: 52, height: 36, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: c.inputBg }}>
                {comp.image_url && <img src={comp.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: c.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.title}</div>
                <div style={{ fontSize: 11.5, color: c.textMuted, textTransform: 'capitalize' }}>
                  {comp.discipline} · {comp.deadline}{comp.prize ? ` · ${comp.prize}` : ''}{comp.is_active ? '' : ' · inactive'}
                </div>
              </div>
              {comp.organizer_url && (
                <a href={comp.organizer_url} target="_blank" rel="noopener noreferrer" style={{ color: c.textMuted, display: 'flex', padding: 4 }}><ExternalLink size={14} /></a>
              )}
              <button onClick={() => openEdit(comp)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 4, display: 'flex' }}><Pencil size={14} /></button>
              <button onClick={() => toggleActive(comp)} disabled={busyId === comp.id} title={comp.is_active ? 'Deactivate' : 'Activate'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: comp.is_active ? '#F97316' : c.textMuted, padding: 4, display: 'flex' }}>
                {comp.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Form modal ── */}
      {showForm && (
        <div
          onClick={() => !saving && setShowForm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: 24, position: 'relative' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary, margin: 0 }}>{editId ? 'Edit competition' : 'Add competition'}</h3>
              <button onClick={() => !saving && setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 4, display: 'flex' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {text('title', 'Title *', 'e.g. Microhome 2026')}
              {text('image_url', 'Image URL', 'https://…')}
              <Field label="Summary (one paragraph)">
                <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>
              <Field label="Brief text (full brief — optional, for later Prep)">
                <textarea value={form.brief_text} onChange={e => setForm(f => ({ ...f, brief_text: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                <Field label="Discipline *">
                  <select value={form.discipline} onChange={e => setForm(f => ({ ...f, discipline: e.target.value as CompetitionDiscipline }))} style={inputStyle}>
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Level">
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as CompetitionLevel }))} style={inputStyle}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                <Field label="Deadline *">
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Registration deadline">
                  <input type="date" value={form.registration_deadline} onChange={e => setForm(f => ({ ...f, registration_deadline: e.target.value }))} style={inputStyle} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                {text('prize', 'Prize', 'e.g. €7,500')}
                {text('entry_fee', 'Entry fee', 'Free / $50')}
              </div>

              {text('location', 'Location', 'Online / Berlin, DE')}
              {text('organizer_url', "Organizer's URL", 'https://…')}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 2 }}>
                {check('student_eligible', 'Student eligible')}
                {check('team_required', 'Team required')}
                {check('is_active', 'Active (visible)')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={save} disabled={saving} style={{
                flex: 1, padding: '11px 0', borderRadius: 100, background: '#F97316', border: 'none',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add competition'}</button>
              <button onClick={() => !saving && setShowForm(false)} style={{
                padding: '11px 22px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`,
                color: c.textPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
