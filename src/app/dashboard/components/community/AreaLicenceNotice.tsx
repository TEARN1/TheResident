'use client'

/**
 * AreaLicenceNotice — where an official learns what their area-messaging
 * licence allows, and how to keep it. Phase F of
 * docs/OFFICIAL-BROADCAST-STRATEGY.md.
 *
 * The tone here is deliberate. A trial that is about to end says so, with a
 * day count, because "12 days left" is what gets a licence renewed and a
 * button that silently stops working one morning is what gets an angry phone
 * call. A lapsed office is told in the same breath that emergencies still
 * send — otherwise an official concludes they have no way to reach anyone at
 * all, which is both false and dangerous.
 */
import React from 'react'
import { Clock, ShieldCheck, CreditCard, AlertTriangle, Loader } from 'lucide-react'
import {
  describeLicence, shouldOfferCheckout, planOffer, startAreaCheckout,
  type AreaLicence
} from '../../../../utils/areaBilling'
import { goldButtonClass } from '../../../../components/ui/GoldButton'

interface Props {
  unitId: string
  licence: AreaLicence | null
}

export default function AreaLicenceNotice({ unitId, licence }: Props) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!licence) return null

  const offer = planOffer(licence.plan)
  const showCheckout = shouldOfferCheckout(licence)
  const lapsed = licence.state === 'lapsed' || licence.state === 'none'

  const handlePay = async () => {
    if (!offer) return
    setBusy(true)
    setError(null)
    const { url, error: checkoutError } = await startAreaCheckout(offer.key, unitId)
    if (url) {
      window.location.href = url
      return
    }
    setError(checkoutError || 'Could not start checkout.')
    setBusy(false)
  }

  const Icon = lapsed ? AlertTriangle : licence.state === 'probation' ? Clock : ShieldCheck
  const tone = lapsed
    ? 'text-yellow-500 bg-yellow-500/5 border-yellow-500/20'
    : 'text-gray-400 bg-white/5 border-white/10'

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${tone}`}>
      <p className="text-[10px] leading-relaxed flex items-start gap-1.5">
        <Icon size={12} className="mt-0.5 shrink-0" />
        <span>{describeLicence(licence)}</span>
      </p>

      {showCheckout && offer && (
        offer.selfServe ? (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handlePay}
              disabled={busy}
              className={`${goldButtonClass()} text-[10px] px-3 py-2 flex items-center gap-1.5 disabled:opacity-50`}
            >
              {busy ? <Loader size={11} className="animate-spin" /> : <CreditCard size={11} />}
              {busy ? 'Opening checkout…' : `${offer.label} — ${offer.price}`}
            </button>
            <p className="text-[9px] text-gray-600">
              Billed to this office, not to you personally — it stays with the role if someone else takes over.
            </p>
          </div>
        ) : (
          // A metro or provincial licence goes through procurement. Showing a
          // Pay button here would be a lie about how that deal actually works.
          <p className="text-[10px] text-gray-400">
            {offer.label} is arranged directly rather than online — get in touch and we will set it up.
          </p>
        )
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
