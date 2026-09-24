'use client'

/**
 * DistanceMatrixPanel — a standalone utility panel for comparing distances
 * between several points at once (pickup spots for a lift club, saved
 * places, search results, etc). Pure presentation over distanceMetres /
 * distanceBand from utils/logic.ts — no new distance math here.
 */
import React from 'react'
import { Ruler, X } from 'lucide-react'
import { distanceMetres, distanceBand } from '../../../../utils/logic'

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
    <div className="p-1 space-y-4">
      <div className="pb-2 border-b border-white/10">
        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
          <Ruler size={15} className="text-gold-primary" /> Multi-Stop Distances
        </h4>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Compare straight-line distances between multiple locations for ride-shares and trips.
        </p>
      </div>

      {points.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-white/3 border border-white/10 rounded-2xl">
          {points.map(p => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full pl-3 pr-2 py-1 text-[11px] text-gray-200 transition-colors shadow-sm"
            >
              <span className="truncate max-w-[140px] font-medium">{p.label}</span>
              <button
                onClick={() => onRemove(p.id)}
                className="text-gray-400 hover:text-red-400 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                title="Remove point"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {points.length < 2 ? (
        <div className="text-center py-6 px-4 bg-white/2 rounded-2xl border border-white/5">
          <Ruler size={24} className="mx-auto text-gray-600 mb-2" />
          <p className="text-xs text-gray-400 font-medium">Add at least 2 points</p>
          <p className="text-[10px] text-gray-600 mt-1">Tap places on the map or add from your saved list to compute routes.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
          {pairs.map(({ a, b, metres }) => (
            <div
              key={`${a.id}-${b.id}`}
              className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl text-xs transition-all shadow-glass"
            >
              <div className="flex flex-col min-w-0 pr-3">
                <span className="text-gray-200 font-medium truncate">{a.label}</span>
                <span className="text-[10px] text-gray-500">to <span className="text-gray-400 font-medium">{b.label}</span></span>
              </div>
              <span className="text-gold-primary font-black px-2.5 py-1 rounded-full bg-gold-primary/10 border border-gold-primary/30 shrink-0 text-xs shadow-sm">
                {distanceBand(metres)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
