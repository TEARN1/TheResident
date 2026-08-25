// Synthesized notification tones — Web Audio oscillators, not sound files.
// Zero assets, zero licensing, fits the free/open-source constraint exactly.
//
// The real notification taxonomy (NotificationPrefsPanel's MUTABLE_TYPES,
// plus PANIC_TYPE) has 14 distinct type strings. One tone per type would be
// noise, not signal — the goal is "I can tell what kind of thing just
// happened without looking," which needs a handful of recognizably
// different tones, not fourteen. So types are grouped into four families:
//   - urgent   (bypasses mute, matches shouldDeliver()'s panic exemption)
//   - safety   (someone responding to a safety-adjacent thing you're in)
//   - money    (rent/utilities/services — the highest-stakes routine category)
//   - social   (casual/relationship actions)
import { PANIC_TYPE } from './logic'

export type ToneFamily = 'urgent' | 'safety' | 'money' | 'social'

const TYPE_FAMILY: Record<string, ToneFamily> = {
  [PANIC_TYPE]: 'urgent',
  res_alert_response: 'safety',
  res_status: 'safety',
  res_lostfound: 'safety',
  res_care_missed: 'safety',
  res_room_request: 'money',
  res_request_approved: 'money',
  res_token_claim: 'money',
  res_dispatch: 'money',
  res_groupbuy_pledge: 'money',
  res_lift_join: 'social',
  res_market_reply: 'social',
  res_trust_request: 'social',
  res_gossip_comment: 'social'
}

export function toneFamilyFor(type: string | undefined): ToneFamily | null {
  if (!type) return null
  return TYPE_FAMILY[type] ?? null
}

// One shared AudioContext — browsers cap how many can exist, and creating
// one per notification would leak. Lazily created because autoplay policy
// forbids creating (or starting) it before a real user gesture.
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  if (!audioCtx) audioCtx = new AudioContextCtor()
  return audioCtx
}

/**
 * Call once from a real user gesture (a click/keydown handler mounted at the
 * dashboard root) so the AudioContext exists and is running before the first
 * notification arrives — browsers refuse to start audio otherwise.
 */
export function unlockNotificationAudio(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

interface ToneStep {
  freq: number
  startOffset: number
  duration: number
  gain?: number
}

// Each family is a short sequence of pure tones (frequency in Hz, offset/
// duration in seconds) rather than a single beep — a couple of quick notes
// reads as more intentional than one flat tone, without needing anything
// louder or longer to feel distinct.
const FAMILY_TONES: Record<ToneFamily, ToneStep[]> = {
  urgent: [
    { freq: 880, startOffset: 0, duration: 0.15, gain: 0.2 },
    { freq: 880, startOffset: 0.2, duration: 0.15, gain: 0.2 },
    { freq: 880, startOffset: 0.4, duration: 0.2, gain: 0.2 }
  ],
  safety: [
    { freq: 660, startOffset: 0, duration: 0.12, gain: 0.14 },
    { freq: 520, startOffset: 0.13, duration: 0.18, gain: 0.14 }
  ],
  money: [
    { freq: 523, startOffset: 0, duration: 0.1, gain: 0.14 },
    { freq: 659, startOffset: 0.1, duration: 0.16, gain: 0.14 }
  ],
  social: [
    { freq: 784, startOffset: 0, duration: 0.09, gain: 0.1 }
  ]
}

function playTones(steps: ToneStep[]): void {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  for (const step of steps) {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = step.freq
    const startAt = ctx.currentTime + step.startOffset
    const endAt = startAt + step.duration
    const peakGain = step.gain ?? 0.15

    // Linear ramp in/out avoids the click a hard on/off edge produces.
    gainNode.gain.setValueAtTime(0, startAt)
    gainNode.gain.linearRampToValueAtTime(peakGain, startAt + 0.01)
    gainNode.gain.linearRampToValueAtTime(0, endAt)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start(startAt)
    osc.stop(endAt)
  }
}

/** Plays the tone for a notification type, or does nothing for an unmapped/undefined type. */
export function playNotificationSound(type: string | undefined): void {
  const family = toneFamilyFor(type)
  if (!family) return
  playTones(FAMILY_TONES[family])
}
