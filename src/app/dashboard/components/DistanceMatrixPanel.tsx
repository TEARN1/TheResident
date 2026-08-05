'use client'

/**
 * DistanceMatrixPanel — a standalone utility panel for comparing distances
 * between several points at once (pickup spots for a lift club, saved
 * places, search results, etc). Pure presentation over distanceMetres /
 * distanceBand from utils/logic.ts — no new distance math here.
 */
import React from 'react'
import { Ruler, X } from 'lucide-react'
import { distanceMetres, distanceBand } from '../../../utils/logic'

export interface MatrixPoint {
  id: string
  label: string
  lat: number
  lon: number
}

interface Props {
  points: MatrixPoint[]
  onRemove: (id: string) => void
}

export default function DistanceMatrixPanel({ points, onRemove }: Props) {
  const pairs: Array<{ a: MatrixPoint; b: MatrixPoint; metres: number }> = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      pairs.push({
        a: points[i],
        b: points[j],
        metres: distanceMetres(points[i], points[j])
      })
    }
  }

  return (
    <div className="glass-panel p-6">
      <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2 mb-1">
        <Ruler size={16} className="text-gold-primary" /> Multi-Stop Distances
      </h4>
      <p className="text-[11px] text-gray-500 mb-4">
        Add 2 or more points to compare distances between every pair — handy for planning lift-club pickups.
      </p>

      {points.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {points.map(p => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full pl-3 pr-1.5 py-1 text-[11px] text-gray-300"
            >
              {p.label}
              <button onClick={() => onRemove(p.id)} className="text-gray-500 hover:text-red-400">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {points.length < 2 ? (
        <p className="text-xs text-gray-500">Add at least 2 points (from search, saved places, or map markers) to see distances.</p>
      ) : (
        <div className="space-y-2">
          {pairs.map(({ a, b, metres }) => (
            <div
              key={`${a.id}-${b.id}`}
              className="flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded-lg text-xs"
            >
              <span className="text-gray-300 truncate pr-2">{a.label} ↔ {b.label}</span>
              <span className="text-gold-primary font-bold shrink-0">{distanceBand(metres)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
