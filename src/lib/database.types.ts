// Types matching Supabase JS v2 (PostgREST v12) — Relationships required or insert/update resolve to never

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ProjectStage = 'pre-design' | 'initial-concept' | 'finalized-design' | 'jury-prep'
export type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed'
export type UserPlan = 'free' | 'monthly' | 'yearly'
export type CompetitionDiscipline = 'architecture' | 'interior' | 'urban' | 'landscape' | 'multi'
export type CompetitionLevel = 'beginner' | 'student' | 'professional' | 'any'

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
          bio: string | null
          instagram: string | null
          linkedin: string | null
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
          bio?: string | null
          instagram?: string | null
          linkedin?: string | null
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
          bio?: string | null
          instagram?: string | null
          linkedin?: string | null
          challenges?: string[]
          onboarding_complete?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          stage: ProjectStage
          discipline: 'architecture' | 'interior' | 'urban' | 'landscape' | null
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
          discipline?: 'architecture' | 'interior' | 'urban' | 'landscape' | null
          focus_areas?: string[]
          brief_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          stage?: ProjectStage
          discipline?: 'architecture' | 'interior' | 'urban' | 'landscape' | null
          focus_areas?: string[]
          brief_text?: string | null
          updated_at?: string
        }
        Relationships: []
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
          is_public: boolean
          caption: string | null
          slide_count: number
          owner_name: string | null
          owner_avatar_url: string | null
          project_name: string | null
          project_stage: string | null
          project_discipline: string | null
          error_message: string | null
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
          is_public?: boolean
          caption?: string | null
          slide_count?: number
          owner_name?: string | null
          owner_avatar_url?: string | null
          project_name?: string | null
          project_stage?: string | null
          project_discipline?: string | null
          error_message?: string | null
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
          is_public?: boolean
          caption?: string | null
          slide_count?: number
          owner_name?: string | null
          owner_avatar_url?: string | null
          project_name?: string | null
          project_stage?: string | null
          project_discipline?: string | null
          error_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          analysis_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          analysis_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          created_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          id: string
          analysis_id: string
          user_id: string
          body: string
          author_name: string | null
          author_avatar_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          analysis_id: string
          user_id: string
          body: string
          author_name?: string | null
          author_avatar_url?: string | null
          created_at?: string
        }
        Update: {
          body?: string
          author_name?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      competitions: {
        Row: {
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
        Insert: {
          id?: string
          title: string
          image_url?: string | null
          summary?: string | null
          brief_text?: string | null
          discipline: CompetitionDiscipline
          deadline: string
          registration_deadline?: string | null
          prize?: string | null
          entry_fee?: string | null
          student_eligible?: boolean
          level?: CompetitionLevel
          team_required?: boolean
          location?: string | null
          organizer_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          title?: string
          image_url?: string | null
          summary?: string | null
          brief_text?: string | null
          discipline?: CompetitionDiscipline
          deadline?: string
          registration_deadline?: string | null
          prize?: string | null
          entry_fee?: string | null
          student_eligible?: boolean
          level?: CompetitionLevel
          team_required?: boolean
          location?: string | null
          organizer_url?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      saved_competitions: {
        Row: {
          user_id: string
          competition_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          competition_id: string
          created_at?: string
        }
        Update: {
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_analyses_used: {
        Args: { uid: string }
        Returns: undefined
      }
    }
    Enums: {
      project_stage: ProjectStage
      analysis_status: AnalysisStatus
      user_plan: UserPlan
    }
    CompositeTypes: Record<string, never>
  }
}
