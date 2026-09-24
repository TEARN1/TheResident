// Lightweight Web Audio micro-haptics & tactile sound generator
// Zero assets, zero network downloads, pure mathematical oscillators.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  if (!audioCtx) audioCtx = new AudioContextCtor()
  return audioCtx
}

export type SoundEffectType = 
  | 'click' 
  | 'pop' 
  | 'chime' 
  | 'success' 
  | 'bell' 
  | 'tab' 
  | 'alert'

export function playTactileSound(type: SoundEffectType): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime

    // Also trigger subtle vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'click' || type === 'tab') navigator.vibrate(8)
      else if (type === 'pop') navigator.vibrate(12)
      else if (type === 'success' || type === 'chime') navigator.vibrate([15, 30, 20])
      else if (type === 'alert') navigator.vibrate([40, 50, 40])
    }

    if (type === 'click' || type === 'tab') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(type === 'tab' ? 520 : 440, now)
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.04)
    } 
    else if (type === 'pop') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.06)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.06)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.06)
    }
    else if (type === 'chime' || type === 'success') {
      // Elegant major chord sparkle (C6, E6, G6)
      const freqs = [1046.5, 1318.5, 1567.98]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const start = now + (idx * 0.05)
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.08, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.35)
      })
    }
    else if (type === 'bell') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.5)
    }
    else if (type === 'alert') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.linearRampToValueAtTime(450, now + 0.15)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch {
    // Autoplay or audio disabled gracefully
  }
}
