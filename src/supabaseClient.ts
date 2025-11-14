import { createClient } from '@supabase/supabase-js'

// Get keys from the .env.local file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// You can add a type for your database schema here later for full type safety
export const supabase = createClient(supabaseUrl, supabaseKey)