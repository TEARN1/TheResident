'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Droplets, Wifi, MapPin, Plus, X, Gift, Tag } from 'lucide-react'
import { supabase } from '../../../utils/supabase'

interface SharedResourceRow {
  id: string
  kind: string
  title: string
  accessNote: string | null
  availability: string | null
  isFree: boolean
  priceNote: string | null
  suburb: string | null
}

interface SharedResourcesTabProps {
  currentUserId: string
  communityId: string | null
}

const iconFor = (kind: string) => {
  if (kind === 'wifi_hotspot') return Wifi
  if (kind === 'borehole' || kind === 'water_point') return Droplets
  return Tag
}

/**
 * Community-scoped board for shared physical resources — boreholes, wifi
 * hotspots, water points. Scoped to the caller's current community when
 * known; otherwise falls back to an unscoped list rather than blocking.
 */
export default function SharedResourcesTab({ currentUserId, communityId }: SharedResourcesTabProps) {
  const [resources, setResources] = useState<SharedResourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState('borehole')
  const [title, setTitle] = useState('')
  const [accessNote, setAccessNote] = useState('')
  const [isFree, setIsFree] = useState(true)
  const [priceNote, setPriceNote] = useState('')
  const [suburb, setSuburb] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('res_shared_resources')
      .select('id, kind, title, access_note, availability, is_free, price_note, suburb, community_id')
      .order('created_at', { ascending: false })
    if (communityId) query = query.eq('community_id', communityId)
    const { data, error: fetchError } = await query
    if (!fetchError && data) {
      setResources(data.map(r => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        accessNote: r.access_note,
        availability: r.availability,
        isFree: r.is_free ?? true,
        priceNote: r.price_note,
        suburb: r.suburb
      })))
    }
    setLoading(false)
  }, [communityId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !currentUserId || !title.trim()) return
    setSubmitting(true)
    setError(null)
    const { error: insertError } = await supabase.from('res_shared_resources').insert({
      owner_id: currentUserId,
      kind,
      title: title.trim(),
      access_note: accessNote.trim() || null,
      is_free: isFree,
      price_note: isFree ? null : (priceNote.trim() || null),
      community_id: communityId,
      suburb: suburb.trim() || null
    })
    setSubmitting(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTitle(''); setAccessNote(''); setPriceNote(''); setSuburb(''); setIsFree(true)
    setShowForm(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Droplets size={20} className="text-gold-primary" /> Shared Resources
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {communityId ? 'Boreholes, hotspots and water points shared within your community.' : 'Join a community to scope this list to your neighbours.'}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gold-primary text-black font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-gold-primary/10 hover:bg-gold-secondary"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Share a Resource'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-black/40 border border-gold-primary/20 rounded-2xl p-6 mb-8 space-y-4">
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select value={kind} onChange={e => setKind(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50">
                <option value="borehole">Borehole</option>
                <option value="wifi_hotspot">Wifi hotspot</option>
                <option value="water_point">Water point</option>
                <option value="other">Other</option>
              </select>
              <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Backup borehole, corner house" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
            </div>
            <input value={accessNote} onChange={e => setAccessNote(e.target.value)} placeholder="How to access it (hours, gate code, etc.)" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
            <input value={suburb} onChange={e => setSuburb(e.target.value)} placeholder="Suburb" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-400 font-bold">
                <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} className="accent-gold-primary" />
                Free to use
              </label>
              {!isFree && (
                <input value={priceNote} onChange={e => setPriceNote(e.target.value)} placeholder="Price note (e.g. R20/fill)" className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
              )}
            </div>
            <button type="submit" disabled={submitting} className="w-full bg-gold-primary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-gold-secondary active:scale-95 transition-all disabled:opacity-50">
              {submitting ? 'Sharing...' : 'Share it'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-500 text-xs uppercase tracking-widest font-bold">Loading resources...</div>
        ) : resources.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Droplets size={48} className="mx-auto mb-4 opacity-10" />
            <p>No shared resources listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map(r => {
              const Icon = iconFor(r.kind)
              return (
                <div key={r.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-gold-primary/20 transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-gold-primary/10 rounded-lg text-gold-primary"><Icon size={18} /></div>
                    {r.isFree ? (
                      <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded uppercase font-bold border border-green-500/20 flex items-center gap-1"><Gift size={10} /> Free</span>
                    ) : (
                      <span className="text-[9px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded uppercase font-bold">{r.priceNote || 'Paid'}</span>
                    )}
                  </div>
                  <h4 className="font-bold text-white text-sm group-hover:text-gold-primary transition-colors">{r.title}</h4>
                  {r.accessNote && <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{r.accessNote}</p>}
                  <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-1 text-[10px] text-gray-600">
                    <MapPin size={10} className="text-gold-primary" /> {r.suburb || 'Location unset'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
