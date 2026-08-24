'use client'

import React, { useEffect, useState } from 'react'
import { Bookmark, Trash2, Plus, X, Loader } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import type { SearchFilters } from '../../../../utils/logic'

interface SavedSearchRow {
  id: string
  name: string
  filters: SearchFilters
  notify: boolean
  created_at: string
}

interface SavedSearchesProps {
  currentFilters: SearchFilters
  onApply: (filters: SearchFilters) => void
}

/**
 * CRUD panel over res_saved_searches. res_match_saved_searches runs
 * server-side on new listings — this component never calls it, it just
 * lets the tenant save/re-apply/delete their own filter presets.
 */
export default function SavedSearches({ currentFilters, onApply }: SavedSearchesProps) {
  const [open, setOpen] = useState(false)
  const [searches, setSearches] = useState<SavedSearchRow[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) { setSearches([]); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSearches([]); return }
    const { data, error: err } = await supabase
      .from('res_saved_searches')
      .select('id, name, filters, notify, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setSearches(err || !data ? [] : (data as SavedSearchRow[]))
  }

  useEffect(() => {
    let cancelled = false
    if (!open) return
    Promise.resolve().then(() => {
      if (!cancelled) load()
    })
    return () => { cancelled = true }
  }, [open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sign in to save searches.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('res_saved_searches').insert({
      user_id: user.id,
      name: newName.trim() || 'Untitled search',
      filters: currentFilters,
      notify: true
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setNewName('')
    load()
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    await supabase.from('res_saved_searches').delete().eq('id', id)
    setSearches(prev => (prev || []).filter(s => s.id !== id))
  }

  const handleApply = (s: SavedSearchRow) => {
    onApply(s.filters || {})
    if (supabase) {
      supabase.from('res_saved_searches').update({ last_opened_at: new Date().toISOString() }).eq('id', s.id)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`p-3 rounded-xl border transition-all ${open ? 'bg-gold-primary border-gold-primary text-black' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
        title="Saved searches"
      >
        <Bookmark size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 glass-panel bg-black border-gold-primary/20 shadow-2xl z-50 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Saved Searches</h4>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
          </div>

          <form onSubmit={handleSave} className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name this search…"
              className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/40"
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-gold-primary text-black px-3 rounded-lg disabled:opacity-50 flex items-center justify-center"
            >
              {saving ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </form>
          {error && <p className="text-[10px] text-red-400 font-bold">{error}</p>}

          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {searches === null && <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Loading…</p>}
            {searches?.length === 0 && <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No saved searches yet.</p>}
            {searches?.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 bg-white/5 border border-white/5 rounded-lg px-3 py-2">
                <button onClick={() => handleApply(s)} className="text-left flex-1 text-xs font-bold text-gray-300 hover:text-gold-primary transition-colors truncate">
                  {s.name}
                </button>
                <button onClick={() => handleDelete(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
