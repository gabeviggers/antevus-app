import { createClient } from './client'
import { createClient as createServerClient } from './server'

export type AuthError = {
  message: string
  status?: number
}

export async function signUp(email: string, password: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    }
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function signIn(email: string, password: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return user
}

export async function getSession() {
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    return null
  }

  return session
}

// Server-side auth functions
export async function getServerSession() {
  const supabase = await createServerClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    return null
  }

  return session
}

export async function getServerUser() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return user
}