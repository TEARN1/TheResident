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
      <h4 className="text-sm font-bold text-content uppercase tracking-wide flex items-center gap-2 mb-4">
        <Bookmark size={16} className="text-accent" /> Saved Places
      </h4>

      {pending && (
        <div className="mb-4 p-3 bg-surface-raised/5 border border-default rounded-xl space-y-2">
          <p className="text-[11px] text-content-muted uppercase font-bold">Save this location</p>
          <p className="text-xs text-content truncate">{pending.label}</p>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Label (e.g. Mom's house)"
              className="flex-1 bg-surface-sunken/20 border border-default rounded-lg px-2 py-1.5 text-xs text-content placeholder:text-content-subtle outline-none focus:border-accent/50"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent/90 hover:bg-accent text-content-on-accent text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              Save
            </button>
          </div>
          {error && <p className="text-[11px] text-danger">{error}</p>}
        </div>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto">
        {loading && <p className="text-xs text-content-muted">Loading saved places…</p>}
        {!loading && pins.length === 0 && (
          <p className="text-xs text-content-muted">No saved places yet — search or tap the map to add one.</p>
        )}
        {pins.map(pin => (
          <div
            key={pin.id}
            className="flex items-center justify-between gap-2 p-2 bg-surface-raised/[0.02] border border-subtle rounded-lg"
          >
            <button
              onClick={() => onJump(pin)}
              className="flex items-center gap-2 text-left flex-1 min-w-0 text-content hover:text-content transition-colors"
            >
              <MapPin size={13} className="text-accent shrink-0" />
              <span className="text-xs truncate">{pin.label}</span>
            </button>
            <button
              onClick={() => onJump(pin)}
              title="Centre map here"
              className="text-content-muted hover:text-accent transition-colors shrink-0"
            >
              <Navigation2 size={13} />
            </button>
            {onAddToMatrix && (
              <button
                onClick={() => onAddToMatrix(pin)}
                title="Add to distance matrix"
                className="text-content-muted hover:text-accent transition-colors shrink-0"
              >
                <Ruler size={13} />
              </button>
            )}
            <button
              onClick={() => onDelete(pin.id)}
              title="Delete"
              className="text-content-muted hover:text-danger transition-colors shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
