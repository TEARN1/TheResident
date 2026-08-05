/**
 * savedPins.ts — CRUD for res_saved_pins, the user's own personal map pins.
 *
 * RLS on the table already restricts every row to `user_id = auth.uid()`, so
 * these helpers never filter by user client-side — the database does that.
 * Best-effort / fails soft, matching the style of mapZones.ts.
 */
import { supabase } from './supabase'

export interface SavedPin {
  id: string
  user_id: string
  label: string
  lat: number
  lon: number
  created_at: string
}

export async function fetchSavedPins(): Promise<SavedPin[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('res_saved_pins')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as SavedPin[]
  } catch {
    return []
  }
}

export async function saveNewPin(label: string, lat: number, lon: number): Promise<SavedPin | null> {
  if (!supabase) throw new Error('Not connected')
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Sign in to save a location')

  const { data, error } = await supabase
    .from('res_saved_pins')
    .insert({ user_id: userId, label: label.trim() || 'Saved place', lat, lon })
    .select()
    .single()
  if (error) throw error
  return data as SavedPin
}

export async function deleteSavedPin(id: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { error } = await supabase.from('res_saved_pins').delete().eq('id', id)
  if (error) throw error
}
