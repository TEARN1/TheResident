'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Home, Plus, X, MapPin, Zap } from 'lucide-react'
import { supabase } from '../../../utils/supabase'

interface QuickRoom {
  id: string
  title: string
  description: string | null
  price: number
  currency: string
  location: string
  suburb: string | null
  createdAt: string
}

interface EmptyRoomBoardProps {
  currentUserId: string
  defaultCurrency?: string
}

/**
 * Low-friction "post an empty room fast" board — a lightweight sibling to the
 * full housing marketplace, not a replacement for it. Rows are res_listings
 * with quick_post = true, so they never leak into the full application flow.
 */
export default function EmptyRoomBoard({ currentUserId, defaultCurrency }: EmptyRoomBoardProps) {
  const [rooms, setRooms] = useState<QuickRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency || 'ZAR')
  const [location, setLocation] = useState('')
  const [suburb, setSuburb] = useState('')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('res_listings')
      .select('id, title, description, price, currency, location, suburb, created_at')
      .eq('quick_post', true)
      .eq('status', 'open')
      .eq('hidden', false)
      .order('created_at', { ascending: false })
    if (!fetchError && data) {
      setRooms(data.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        price: Number(r.price),
        currency: r.currency || 'ZAR',
        location: r.location,
        suburb: r.suburb,
        createdAt: r.created_at
      })))
    }
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !currentUserId || !title.trim() || !location.trim() || !price) return
    setSubmitting(true)
    setError(null)
    const { error: insertError } = await supabase.from('res_listings').insert({
      landlord_id: currentUserId,
      title: title.trim(),
      description: description.trim() || null,
      price: Number(price),
      currency,
      location: location.trim(),
      suburb: suburb.trim() || null,
      quick_post: true,
      status: 'open'
    })
    setSubmitting(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTitle(''); setPrice(''); setLocation(''); setSuburb(''); setDescription('')
    setShowForm(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap size={20} className="text-gold-primary" /> Empty Room Board
            </h3>
            <p className="text-xs text-gray-500 mt-1">Got a room free tonight? Post it in seconds — no full listing required.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gold-primary text-black font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-gold-primary/10 hover:bg-gold-secondary"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Post a Room'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-black/40 border border-gold-primary/20 rounded-2xl p-6 mb-8 space-y-4">
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Spare room, available now" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
              <input value={location} onChange={e => setLocation(e.target.value)} required placeholder="Address / location" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} required placeholder="Price" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50">
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
                <option value="NGN">NGN</option>
                <option value="KES">KES</option>
                <option value="GBP">GBP</option>
              </select>
              <input value={suburb} onChange={e => setSuburb(e.target.value)} placeholder="Suburb" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
            </div>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="One line about the room" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
            <button type="submit" disabled={submitting} className="w-full bg-gold-primary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-gold-secondary active:scale-95 transition-all disabled:opacity-50">
              {submitting ? 'Posting...' : 'Post to the board'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-500 text-xs uppercase tracking-widest font-bold">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Home size={48} className="mx-auto mb-4 opacity-10" />
            <p>No empty rooms posted right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rooms.map(room => (
              <div key={room.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-gold-primary/20 transition-all group">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-gold-primary">{room.currency} {room.price}</span>
                  <span className="text-[9px] bg-gold-primary/10 text-gold-primary px-1.5 py-0.5 rounded uppercase font-bold border border-gold-primary/20">Quick post</span>
                </div>
                <h4 className="font-bold text-white text-sm group-hover:text-gold-primary transition-colors">{room.title}</h4>
                {room.description && <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{room.description}</p>}
                <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-1 text-[10px] text-gray-600">
                  <MapPin size={10} className="text-gold-primary" /> {room.suburb || room.location}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
