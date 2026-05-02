import { supabase } from './supabase'
import type { Database, ProjectStage } from './database.types'

type Project = Database['public']['Tables']['projects']['Row']
type Analysis = Database['public']['Tables']['analyses']['Row']
type JurySession = Database['public']['Tables']['jury_sessions']['Row']

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      analyses (
        id, status, concept_score, spatial_score, presentation_score, created_at
      )
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      analyses (*)
    `)
    .eq('id', projectId)
    .single()

  if (error) throw error
  return data
}

export async function createProject(userId: string, payload: {
  name: string
  stage: ProjectStage
  focus_areas: string[]
  brief_text?: string
}) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, ...payload })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) throw error
}

// ─── Analyses ─────────────────────────────────────────────────────────────────

export async function getAnalysis(analysisId: string) {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .single()

  if (error) throw error
  return data
}

export async function getLatestAnalysis(projectId: string) {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) throw error
  return data
}

export async function createAnalysis(projectId: string, userId: string) {
  const { data, error } = await supabase
    .from('analyses')
    .insert({ project_id: projectId, user_id: userId, status: 'pending' })
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── PDF Storage ──────────────────────────────────────────────────────────────

export async function uploadPDF(userId: string, projectId: string, file: File) {
  const path = `${userId}/${projectId}/${Date.now()}_${file.name}`

  const { error } = await supabase.storage
    .from('project-pdfs')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) throw error
  return path
}

export function getPDFUrl(path: string) {
  const { data } = supabase.storage
    .from('project-pdfs')
    .getPublicUrl(path)
  return data.publicUrl
}

// ─── Jury Sessions ────────────────────────────────────────────────────────────

export async function getJurySessions(userId: string) {
  const { data, error } = await supabase
    .from('jury_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function saveJurySession(session: Omit<JurySession, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('jury_sessions')
    .insert(session)
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfile(userId: string, updates: {
  full_name?: string
  language?: string
}) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function incrementAnalysesUsed(userId: string) {
  const { error } = await supabase.rpc('increment_analyses_used', { uid: userId })
  if (error) throw error
}
