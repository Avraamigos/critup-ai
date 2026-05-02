import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
}

interface AuthContext extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState(s => ({ ...s, loading: false }))
      return
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const profile = session?.user ? await fetchProfile(session.user.id) : null
      setState({ user: session?.user ?? null, session, profile, loading: false })
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const profile = session?.user ? await fetchProfile(session.user.id) : null
      setState({ user: session?.user ?? null, session, profile, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error: error.message }

    // Create profile row
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        plan: 'free',
        language: 'en',
        analyses_used: 0,
      })
    }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (state.user) {
      const profile = await fetchProfile(state.user.id)
      setState(s => ({ ...s, profile }))
    }
  }

  return (
    <Ctx.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Guard hook — redirects to /login if not authenticated
export function useRequireAuth() {
  const auth = useAuth()
  return auth
}
