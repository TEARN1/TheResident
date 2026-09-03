'use client'

/**
 * AreaNoticesPanel — the notices a resident received because of where they
 * live, and the public record of what each office has been sending.
 *
 * Both halves read functions that Phase D shipped and nothing called:
 * res_my_area_notices (self-scoped) and res_area_broadcast_history (public).
 * A permanent public record that no screen ever displays is not
 * accountability, it is a table.
 *
 * The two tabs sit together on purpose. A resident who just got an
 * unwelcome 6am notice from the municipality can, in one tap, see how often
 * that office sends and what it has said — which is the check on the power
 * this feature hands out.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Megaphone, MapPin, Check, Loader, History, Inbox, AlertTriangle } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../../../store'
import {
  fetchMyAreaNotices, fetchAreaBroadcastHistory, acknowledgeAreaBroadcast,
  type AreaNotice, type AreaBroadcastRecord
} from '../../../../utils/areaTargeting'
import EmptyState from '../shared/EmptyState'

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/25',
  urgent: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/25',
  important: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  normal: 'text-gray-400 bg-white/5 border-white/10'
}

const when = (iso: string) => {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default function AreaNoticesPanel() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const guest = currentUser ? isGuestUser(currentUser) : true

  const [view, setView] = useState<'mine' | 'record'>('mine')
  const [mine, setMine] = useState<AreaNotice[]>([])
  const [record, setRecord] = useState<AreaBroadcastRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [acking, setAcking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [notices, history] = await Promise.all([
        fetchMyAreaNotices(),
        fetchAreaBroadcastHistory()
      ])
      setMine(notices)
      setRecord(history)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!guest) load() }, [guest, load])

  const acknowledge = async (id: string) => {
    setAcking(id)
    try {
      await acknowledgeAreaBroadcast(id)
      setMine(list => list.map(n =>
        n.id === id ? { ...n, acknowledgedAt: new Date().toISOString() } : n
      ))
    } catch {
      // Acknowledging is a courtesy signal to the sender, not something worth
      // an error banner on a screen the resident opened to read a notice.
    } finally {
      setAcking(null)
    }
  }

  if (guest) return null

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-gold-primary/10 rounded-xl">
          <Megaphone size={18} className="text-gold-primary" />
        </div>
        <div>
          <p className="text-xs font-black text-white uppercase tracking-widest">Area Notices</p>
          <p className="text-[10px] text-gray-500">From your municipality, ward, library, clinic or station</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {([['mine', 'For my area', Inbox], ['record', 'Public record', History]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              view === id ? 'bg-gold-primary/15 text-gold-primary' : 'bg-white/5 text-gray-500 hover:text-white'
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-500 flex items-center gap-2">
          <Loader size={13} className="animate-spin" /> Loading…
        </p>
      ) : view === 'mine' ? (
        mine.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No area notices yet"
            subtitle="When your municipality, ward councillor or a nearby institution sends a notice covering where you live, it will appear here. Set a home area on your profile so they can reach you."
          />
        ) : (
          <div className="space-y-2">
            {mine.map(n => (
              <div key={n.id} className={`rounded-xl border p-3 space-y-2 ${PRIORITY_STYLE[n.priority] || PRIORITY_STYLE.normal}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-white">{n.title}</p>
                  <span className="text-[9px] text-gray-500 shrink-0">{when(n.sentAt)}</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">{n.body}</p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[9px] text-gray-500 flex items-center gap-1">
                    <MapPin size={10} /> {n.unitName} · {n.targetLabel}
                  </p>
                  {n.priority === 'critical' && (
                    n.acknowledgedAt ? (
                      <span className="text-[9px] text-green-400 flex items-center gap-1">
                        <Check size={10} /> Acknowledged
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => acknowledge(n.id)}
                        disabled={acking === n.id}
                        className="text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md disabled:opacity-50"
                      >
                        {acking === n.id ? 'Saving…' : 'I have seen this'}
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : record.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing has been broadcast yet"
          subtitle="Every notice an official sends to an area is listed here permanently — who sent it, what area it covered, and how many people it reached."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 leading-relaxed flex items-start gap-1.5">
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-gray-600" />
            Every area notice ever sent, by anyone. Senders cannot edit or delete what they
            broadcast — this is the record of how often each office uses the channel.
          </p>
          {record.map(b => (
            <div key={b.id} className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold text-white">{b.unitName}</p>
                <span className="text-[9px] text-gray-600 shrink-0">{when(b.sentAt)}</span>
              </div>
              <p className="text-[11px] text-gray-300">{b.title}</p>
              <p className="text-[9px] text-gray-600">
                {b.targetLabel} · {b.priority}
                {b.category ? ` · ${b.category}` : ''} · reached {b.recipientCount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
