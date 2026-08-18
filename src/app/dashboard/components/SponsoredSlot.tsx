'use client'

import React, { useEffect, useState } from 'react'
import { Store, ChevronRight } from 'lucide-react'
import { fetchSponsored, recordSponsoredOpen, type SponsoredEntry } from '../../../utils/sponsorshipApi'
import { SPONSORED_LABEL, isSellableSurface } from '../../../utils/sponsorship'
import type { Surface } from '../../../utils/sponsorship'

// The sponsored slot sits ABOVE a list and never inside it. The list below is
// complete and unchanged — a sponsor buys position, not a place, so nobody has
// been pushed down to make room.
//
// Two rules this component will not bend:
//
//   1. The "Sponsored" label is always rendered, cannot be dismissed, and is
//      never softened into "Featured" or "Partner". South African advertising
//      rules require the disclosure, and more practically it is the reason a
//      resident can still trust the rest of the list.
//   2. It refuses to render on a safety surface. isSellableSurface() is
//      checked here as well as in the API and the database — three times,
//      because an advert beside a panic alert is the kind of mistake you only
//      get to make once.
//
// If nothing is sold, this renders nothing at all. An empty "advertise here"
// placeholder would make a young app look emptier than it is.

interface SponsoredSlotProps {
  surface: Surface
  suburb: string
  category?: string | null
  /** Opens the promoted listing. Kept in-app — a sponsorship never links out. */
  onOpen?: (entry: SponsoredEntry) => void
}

export default function SponsoredSlot({ surface, suburb, category = null, onOpen }: SponsoredSlotProps) {
  const [entries, setEntries] = useState<SponsoredEntry[]>([])

  // Belt and braces: never even attempt a fetch for a surface that is not for
  // sale. Derived rather than set inside the effect — gating the RENDER on
  // this means stale entries from a previous surface can never appear, without
  // a synchronous setState that would trigger a cascading re-render.
  const eligible = isSellableSurface(surface) && !!suburb

  useEffect(() => {
    if (!eligible) return
    let cancelled = false

    fetchSponsored(surface, suburb, category)
      .then(rows => { if (!cancelled) setEntries(rows) })
      .catch(() => { if (!cancelled) setEntries([]) })

    return () => { cancelled = true }
  }, [eligible, surface, suburb, category])

  if (!eligible || entries.length === 0) return null

  return (
    <div style={{ marginBottom: '1rem' }}>
      {entries.map(entry => (
        <div
          key={entry.id}
          onClick={() => { void recordSponsoredOpen(entry.id); onOpen?.(entry) }}
          role={onOpen ? 'button' : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onKeyDown={e => {
            if (onOpen && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              void recordSponsoredOpen(entry.id)
              onOpen(entry)
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 0.9rem',
            marginBottom: '0.5rem',
            borderRadius: '0.75rem',
            // Deliberately part of the app rather than a foreign ad block:
            // a faint tint and a left rule, not a boxed banner.
            background: 'rgba(37, 99, 235, 0.05)',
            borderLeft: '3px solid rgba(37, 99, 235, 0.45)',
            cursor: onOpen ? 'pointer' : 'default'
          }}
        >
          <Store size={18} style={{ color: '#2563eb', flexShrink: 0 }} aria-hidden />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 600, fontSize: '0.95rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {entry.subjectName}
            </div>
            {/* Always present. Never dismissible. */}
            <div style={{
              fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase',
              color: '#64748b', marginTop: '0.15rem'
            }}>
              {SPONSORED_LABEL}
            </div>
          </div>

          {onOpen && <ChevronRight size={16} style={{ color: '#94a3b8', flexShrink: 0 }} aria-hidden />}
        </div>
      ))}
    </div>
  )
}
