// Go-to-market settings, set per deployment (Vercel → Settings →
// Environment Variables) so they can change without a code change.
//
// NEXT_PUBLIC_LAUNCH_AREA        The one suburb the app is launching in
//                                first, e.g. "Braamfontein". Unset = no
//                                launch banner anywhere.
// NEXT_PUBLIC_CONCIERGE_WHATSAPP The founder's WhatsApp number in
//                                international form, e.g. 27821234567.
//                                Unset = no "list with our help" button.

export const LAUNCH_AREA = (process.env.NEXT_PUBLIC_LAUNCH_AREA || '').trim()

export const CONCIERGE_WHATSAPP = (process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP || '').replace(/\D/g, '')

/** A wa.me link straight to the founder with a ready-to-send message, so a
 *  landlord can list a room by sending photos instead of filling a form. */
export function conciergeWhatsAppUrl(area?: string, number: string = CONCIERGE_WHATSAPP): string | null {
  if (!number) return null
  const where = area ? ` in ${area}` : ''
  const text = `Hi! I'd like to list a room${where} on The Resident. I'll send photos, the monthly rent and the address.`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/**
 * Where to go after signing in, from the `next` query param the proxy adds
 * when it bounces a logged-out visitor off a /dashboard link (for example a
 * room shared on WhatsApp). Only same-site dashboard paths are accepted, so
 * the param can't be used to send someone to another site.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  if (!raw.startsWith('/dashboard')) return fallback
  if (raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return fallback
  const rest = raw.slice('/dashboard'.length)
  if (rest && !/^[/?#]/.test(rest)) return fallback
  return raw
}
