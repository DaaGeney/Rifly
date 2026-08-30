import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Sin variables de entorno la app corre en "modo demo" con datos en localStorage.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const isDemo = supabase === null

export const ADMIN_EMAIL = 'diegoassia@gmail.com'
