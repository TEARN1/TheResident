'use client'

/**
 * PushAlertsPanel — lets a resident turn on alerts that reach their phone with
 * the app closed. Phase E of docs/OFFICIAL-BROADCAST-STRATEGY.md.
 *
 * Why this is opt-in and sits behind a button rather than a prompt on load:
 * a browser gives a site exactly one chance to ask, and a permission dialog
 * fired at someone who has no idea why gets denied — permanently, with no way
 * for the page to ask again. So the panel explains what it is for first, and
 * the resident presses the button when they have decided.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { BellRing, Loader, Check, AlertTriangle } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../../../store'
import {
  getPushState, enablePush, disablePush, describePushState, type PushState
} from '../../../../utils/webPush'
import { goldButtonClass } from '../../../../components/ui/GoldButton'

export default function PushAlertsPanel() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const guest = currentUser ? isGuestUser(currentUser) : true

  const [state, setState] = useState<PushState>('available')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setState(await getPushState())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const toggle = async () => {
    if (!currentUser) return
    setBusy(true)
    setError(null)
    try {
      setState(state === 'subscribed' ? await disablePush() : await enablePush(currentUser.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your alert settings.')
    } finally {
      setBusy(false)
    }
  }

  if (guest) return null

  const on = state === 'subscribed'
  const blocked = state === 'denied' || state === 'unsupported'

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gold-primary/10 rounded-lg text-gold-primary shrink-0">
          <BellRing size={18} />
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Emergency Alerts</h3>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            Lets urgent notices — an evacuation, a water shutdown, a missing child — reach this
            device even when the app is closed. Without this, they only appear the next time you
            open the app.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-500 flex items-center gap-2">
          <Loader size={13} className="animate-spin" /> Checking…
        </p>
      ) : (
        <>
          <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-1">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Status</p>
            <p className={`text-[11px] leading-relaxed ${on ? 'text-green-400' : blocked ? 'text-yellow-500' : 'text-gray-400'}`}>
              {on && <Check size={12} className="inline mr-1 -mt-0.5" />}
              {blocked && <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />}
              {describePushState(state)}
            </p>
          </div>

          {!blocked && (
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className={on
                ? 'flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-red-400 font-black uppercase tracking-widest transition-colors disabled:opacity-50'
                : `${goldButtonClass()} disabled:opacity-50`}
            >
              {busy ? 'Working…' : on ? 'Turn off alerts on this device' : 'Turn on emergency alerts'}
            </button>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <p className="text-[10px] text-gray-600 leading-relaxed">
            This applies to this device only, and you can turn it off here at any time. Alerts carry
            only what the notice says — never your location.
          </p>
        </>
      )}
    </div>
  )
}
