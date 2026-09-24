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
    <div className="p-1 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Bookmark size={15} className="text-gold-primary" /> Saved Places
        </h4>
        <span className="text-[10px] font-bold text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
          {pins.length} saved
        </span>
      </div>

      {pending && (
        <div className="p-3.5 bg-gold-primary/5 border border-gold-primary/20 rounded-2xl space-y-2.5 shadow-glass">
          <p className="text-[10px] text-gold-primary font-black uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={12} /> Save Selected Spot
          </p>
          <p className="text-xs text-gray-200 truncate font-medium">{pending.label}</p>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Home, Office, Lift Point"
              className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-gold-primary/70 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gold-primary hover:bg-gold-secondary text-black text-xs font-black px-3.5 py-2 rounded-xl transition-all shadow-md disabled:opacity-50 shrink-0"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      )}

      <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
        {loading && <p className="text-xs text-gray-400 py-3 text-center">Loading your saved spots…</p>}
        {!loading && pins.length === 0 && (
          <div className="text-center py-6 px-4 bg-white/2 rounded-2xl border border-white/5">
            <MapPin size={24} className="mx-auto text-gray-600 mb-2" />
            <p className="text-xs text-gray-400 font-medium">No saved places yet</p>
            <p className="text-[10px] text-gray-600 mt-1">Tap anywhere on the map or search to save quick locations.</p>
          </div>
        )}
        {pins.map(pin => (
          <div
            key={pin.id}
            className="flex items-center justify-between gap-2 p-2.5 bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl transition-all group"
          >
            <button
              onClick={() => onJump(pin)}
              className="flex items-center gap-2.5 text-left flex-1 min-w-0"
            >
              <div className="w-7 h-7 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center shrink-0 group-hover:bg-gold-primary/20 transition-colors">
                <MapPin size={13} className="text-gold-primary" />
              </div>
              <span className="text-xs font-medium text-gray-200 truncate group-hover:text-white transition-colors">{pin.label}</span>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onJump(pin)}
                title="View on map"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gold-primary hover:bg-white/5 transition-colors"
              >
                <Navigation2 size={13} />
              </button>
              {onAddToMatrix && (
                <button
                  onClick={() => onAddToMatrix(pin)}
                  title="Add to distance matrix"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gold-primary hover:bg-white/5 transition-colors"
                >
                  <Ruler size={13} />
                </button>
              )}
              <button
                onClick={() => onDelete(pin.id)}
                title="Delete saved pin"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
