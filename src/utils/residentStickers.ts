/**
 * In-App Safety-Certified Stickers for The Resident
 *
 * Stickers are constructed and maintained entirely client-side.
 * No external image URLs or untrusted asset hosts are permitted,
 * ensuring complete safety and zero XSS vectors.
 */

export interface ResidentSticker {
  id: string
  label: string
  emoji: string
  category: 'co-living' | 'safety' | 'local'
  tag: string
}

export const RESIDENT_STICKERS: ResidentSticker[] = [
  { id: 'keys', label: 'House Keys', emoji: '🔑', category: 'co-living', tag: '[sticker:keys]' },
  { id: 'candle', label: 'Loadshedding Candle', emoji: '🕯️', category: 'local', tag: '[sticker:candle]' },
  { id: 'power', label: 'Power Restored', emoji: '⚡', category: 'local', tag: '[sticker:power]' },
  { id: 'water', label: 'Water Running', emoji: '🚰', category: 'local', tag: '[sticker:water]' },
  { id: 'shield', label: 'Safe & Sound', emoji: '🛡️', category: 'safety', tag: '[sticker:shield]' },
  { id: 'bakkie', label: 'Bakkie Transport', emoji: '🛻', category: 'local', tag: '[sticker:bakkie]' },
  { id: 'pot', label: 'House Cooking', emoji: '🥘', category: 'co-living', tag: '[sticker:pot]' },
  { id: 'braai', label: 'Braai Night', emoji: '🥩', category: 'co-living', tag: '[sticker:braai]' },
  { id: 'paid', label: 'Rent Settled', emoji: '💰', category: 'co-living', tag: '[sticker:paid]' },
  { id: 'wifi', label: 'Fibre Live', emoji: '📶', category: 'co-living', tag: '[sticker:wifi]' },
  { id: 'clean', label: 'Chores Done', emoji: '✨', category: 'co-living', tag: '[sticker:clean]' },
  { id: 'quiet', label: 'Quiet Hours', emoji: '🤫', category: 'co-living', tag: '[sticker:quiet]' },
  { id: 'tea', label: 'Rooibos Tea', emoji: '☕', category: 'local', tag: '[sticker:tea]' },
  { id: 'saps', label: 'CPF Watch', emoji: '🚔', category: 'safety', tag: '[sticker:saps]' },
]

export const STICKER_MAP = new Map(RESIDENT_STICKERS.map(s => [s.id, s]))

/**
 * Returns sticker object from tag like "[sticker:keys]"
 */
export function getStickerByTag(tag: string): ResidentSticker | undefined {
  const match = tag.match(/^\[sticker:([a-z0-9-]+)\]$/i)
  if (!match) return undefined
  return STICKER_MAP.get(match[1])
}
