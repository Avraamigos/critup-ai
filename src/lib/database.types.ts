// Auto-generated types from Supabase schema
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ProjectStage = 'pre-design' | 'initial-concept' | 'finalized-design' | 'jury-prep'
export type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed'
export type UserPlan = 'free' | 'monthly' | 'yearly'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          plan: UserPlan
          language: string
          analyses_used: number
          discipline: string | null
          year: string | null
          university: string | null
          challenges: string[]
          onboarding_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          plan?: UserPlan
          language?: string
          analyses_used?: number
          discipline?: string | null
          year?: string | null
          university?: string | null
          challenges?: string[]
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          plan?: UserPlan
          language?: string
          analyses_used?: number
          discipline?: string | null
          year?: string | null
          university?: string | null
          challenges?: string[]
          onboarding_complete?: boolean
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          stage: ProjectStage
          focus_areas: string[]
          brief_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          stage: ProjectStage
          focus_areas?: string[]
          brief_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          stage?: ProjectStage
          focus_areas?: string[]
          brief_text?: string | null
          updated_at?: string
        }
      }
      analyses: {
        Row: {
          id: string
          project_id: string
          user_id: string
          status: AnalysisStatus
          concept_score: number | null
          spatial_score: number | null
          presentation_score: number | null
          feedback: Json | null
          jury_questions: Json | null
          pdf_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          status?: AnalysisStatus
          concept_score?: number | null
          spatial_score?: number | null
          presentation_score?: number | null
          feedback?: Json | null
          jury_questions?: Json | null
          pdf_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: AnalysisStatus
          concept_score?: number | null
          spatial_score?: number | null
          presentation_score?: number | null
          feedback?: Json | null
          jury_questions?: Json | null
          updated_at?: string
        }
      }
      jury_sessions: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          question: string
          answer: string | null
          clarity_score: number | null
          confidence_score: number | null
          content_score: number | null
          ai_feedback: string | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          question: string
          answer?: string | null
          clarity_score?: number | null
          confidence_score?: number | null
          content_score?: number | null
          ai_feedback?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          answer?: string | null
          clarity_score?: number | null
          confidence_score?: number | null
          content_score?: number | null
          ai_feedback?: string | null
          duration_seconds?: number | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      project_stage: ProjectStage
      analysis_status: AnalysisStatus
      user_plan: UserPlan
    }
  }
}
