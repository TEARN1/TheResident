'use client'

import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Bell, Moon, Save, Check } from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import { PANIC_TYPE } from '../../../utils/logic'

// Curated list of mutable notification types — pulled from the RPC/type
// strings actually in use (CONTRACT.md §4 + res_alert_panic in logic.ts).
// res_alert_panic is deliberately NOT offered: shouldDeliver() always
// delivers panic alerts regardless of mute prefs.
const MUTABLE_TYPES: { value: string; label: string }[] = [
  { value: 'res_room_request', label: 'Room requests' },
  { value: 'res_request_approved', label: 'Request approved/rejected' },
  { value: 'res_lift_join', label: 'Lift club joins' },
  { value: 'res_dispatch', label: 'Service dispatches' },
  { value: 'res_token_claim', label: 'Utility token claims' },
  { value: 'res_alert_response', label: 'Alert responses' },
  { value: 'res_market_reply', label: 'Marketplace replies' },
  { value: 'res_groupbuy_pledge', label: 'Group buy pledges' },
  { value: 'res_lostfound', label: 'Lost & found updates' },
  { value: 'res_care_missed', label: 'Care circle check-ins' },
  { value: 'res_status', label: 'Neighbourhood status updates' },
  { value: 'res_trust_request', label: 'Trust circle requests' },
  { value: 'res_gossip_comment', label: 'Gossip comments' }
]

interface Prefs {
  muted_types: string[]
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  digest: boolean
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function NotificationPrefsPanel() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const myId = currentUser?.id

  const [prefs, setPrefs] = useState<Prefs>({ muted_types: [], quiet_hours_start: null, quiet_hours_end: null, digest: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!supabase || !myId) { setLoading(false); return }
      const { data } = await supabase
        .from('res_notification_prefs')
        .select('muted_types, quiet_hours_start, quiet_hours_end, digest')
        .eq('user_id', myId)
        .maybeSingle()
      if (data) {
        setPrefs({
          muted_types: data.muted_types || [],
          quiet_hours_start: data.quiet_hours_start ?? null,
          quiet_hours_end: data.quiet_hours_end ?? null,
          digest: !!data.digest
        })
      }
      setLoading(false)
    }
    load()
  }, [myId])

  const toggleType = (type: string) => {
    setSaved(false)
    setPrefs(prev => ({
      ...prev,
      muted_types: prev.muted_types.includes(type)
        ? prev.muted_types.filter(t => t !== type)
        : [...prev.muted_types, type]
    }))
  }

  const save = async () => {
    if (!supabase || !myId) return
    setSaving(true)
    setError(null)
    const { error: upsertError } = await supabase
      .from('res_notification_prefs')
      .upsert({
        user_id: myId,
        muted_types: prefs.muted_types,
        quiet_hours_start: prefs.quiet_hours_start,
        quiet_hours_end: prefs.quiet_hours_end,
        digest: prefs.digest,
        updated_at: new Date().toISOString()
      })
    setSaving(false)
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return <div className="glass-panel p-6 text-xs text-gray-500">Loading notification preferences…</div>
  }

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-gold-primary" />
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Notification preferences</h3>
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-3">Mute specific notification types. Panic alerts always reach you.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {MUTABLE_TYPES.map(t => (
            <label key={t.value} className="flex items-center gap-2 p-2.5 bg-black/40 border border-white/5 rounded-lg text-xs text-gray-300 cursor-pointer hover:border-white/10">
              <input
                type="checkbox"
                checked={prefs.muted_types.includes(t.value)}
                onChange={() => toggleType(t.value)}
                className="accent-[#D4AF37]"
              />
              {t.label}
            </label>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-2">Panic alerts ({PANIC_TYPE}) can&apos;t be muted here.</p>
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-3 flex items-center gap-1.5"><Moon size={12} className="text-gold-primary" /> Quiet hours</p>
        <div className="flex items-center gap-3">
          <select
            value={prefs.quiet_hours_start ?? ''}
            onChange={e => setPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value === '' ? null : Number(e.target.value) }))}
            className="bg-black border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-gold-primary/40"
          >
            <option value="">Off</option>
            {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
          </select>
          <span className="text-gray-600 text-xs">to</span>
          <select
            value={prefs.quiet_hours_end ?? ''}
            onChange={e => setPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value === '' ? null : Number(e.target.value) }))}
            className="bg-black border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-gold-primary/40"
          >
            <option value="">Off</option>
            {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={prefs.digest}
          onChange={e => setPrefs(prev => ({ ...prev, digest: e.target.checked }))}
          className="accent-[#D4AF37]"
        />
        Send me a digest instead of individual notifications
      </label>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2.5 px-5 rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-50"
      >
        {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> {saving ? 'Saving…' : 'Save preferences'}</>}
      </button>
    </div>
  )
}
