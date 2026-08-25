'use client'

/**
 * SavedPinsPanel — "Save this location" affordance plus the list/manager for
 * the user's res_saved_pins. VibeMap owns the marker layer for these points
 * (so it can render them on the Leaflet map); this panel is the glass-panel
 * UI for saving a pending point and browsing/deleting/jumping to saved ones.
 */
import React, { useState } from 'react'
import { Bookmark, MapPin, Trash2, Navigation2, Ruler } from 'lucide-react'
import type { SavedPin } from '../../../../utils/savedPins'

interface PendingPoint {
  label: string
  lat: number
  lon: number
}

interface Props {
  pending: PendingPoint | null
  pins: SavedPin[]
  loading: boolean
  onSave: (label: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onJump: (pin: SavedPin) => void
  onAddToMatrix?: (pin: SavedPin) => void
}

export default function SavedPinsPanel({ pending, pins, loading, onSave, onDelete, onJump, onAddToMatrix }: Props) {
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(label || pending?.label || 'Saved place')
      setLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this pin')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-panel p-6">
      <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2 mb-4">
        <Bookmark size={16} className="text-gold-primary" /> Saved Places
      </h4>

      {pending && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
          <p className="text-[11px] text-gray-500 uppercase font-bold">Save this location</p>
          <p className="text-xs text-gray-300 truncate">{pending.label}</p>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Label (e.g. Mom's house)"
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-gold-primary/50"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gold-primary/90 hover:bg-gold-primary text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              Save
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto">
        {loading && <p className="text-xs text-gray-500">Loading saved places…</p>}
        {!loading && pins.length === 0 && (
          <p className="text-xs text-gray-500">No saved places yet — search or tap the map to add one.</p>
        )}
        {pins.map(pin => (
          <div
            key={pin.id}
            className="flex items-center justify-between gap-2 p-2 bg-white/2 border border-white/5 rounded-lg"
          >
            <button
              onClick={() => onJump(pin)}
              className="flex items-center gap-2 text-left flex-1 min-w-0 text-gray-300 hover:text-white transition-colors"
            >
              <MapPin size={13} className="text-gold-primary shrink-0" />
              <span className="text-xs truncate">{pin.label}</span>
            </button>
            <button
              onClick={() => onJump(pin)}
              title="Centre map here"
              className="text-gray-500 hover:text-gold-primary transition-colors shrink-0"
            >
              <Navigation2 size={13} />
            </button>
            {onAddToMatrix && (
              <button
                onClick={() => onAddToMatrix(pin)}
                title="Add to distance matrix"
                className="text-gray-500 hover:text-gold-primary transition-colors shrink-0"
              >
                <Ruler size={13} />
              </button>
            )}
            <button
              onClick={() => onDelete(pin.id)}
              title="Delete"
              className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
