/**
 * In-App Safety-Certified Stickers for The Resident
 *
 * Stickers are constructed and maintained entirely client-side.
 * No external image URLs or untrusted asset hosts are permitted,
 * ensuring complete safety and zero XSS vectors.
 */

export type StickerCategory = 'all' | 'co-living' | 'safety' | 'local' | 'utilities'

export interface ResidentSticker {
  id: string
  label: string
  emoji: string
  category: 'co-living' | 'safety' | 'local' | 'utilities'
  tag: string
}

export const RESIDENT_STICKERS: ResidentSticker[] = [
  { id: 'keys', label: 'House Keys', emoji: '🔑', category: 'co-living', tag: '[sticker:keys]' },
  { id: 'candle', label: 'Loadshedding Candle', emoji: '🕯️', category: 'utilities', tag: '[sticker:candle]' },
  { id: 'power', label: 'Power Restored', emoji: '⚡', category: 'utilities', tag: '[sticker:power]' },
  { id: 'water', label: 'Water Running', emoji: '🚰', category: 'utilities', tag: '[sticker:water]' },
  { id: 'shield', label: 'Safe & Sound', emoji: '🛡️', category: 'safety', tag: '[sticker:shield]' },
  { id: 'bakkie', label: 'Bakkie Transport', emoji: '🛻', category: 'local', tag: '[sticker:bakkie]' },
  { id: 'pot', label: 'House Cooking', emoji: '🥘', category: 'co-living', tag: '[sticker:pot]' },
  { id: 'braai', label: 'Braai Night', emoji: '🥩', category: 'co-living', tag: '[sticker:braai]' },
  { id: 'paid', label: 'Rent Settled', emoji: '💰', category: 'co-living', tag: '[sticker:paid]' },
  { id: 'wifi', label: 'Fibre Live', emoji: '📶', category: 'utilities', tag: '[sticker:wifi]' },
  { id: 'clean', label: 'Chores Done', emoji: '✨', category: 'co-living', tag: '[sticker:clean]' },
  { id: 'quiet', label: 'Quiet Hours', emoji: '🤫', category: 'co-living', tag: '[sticker:quiet]' },
  { id: 'tea', label: 'Rooibos Tea', emoji: '☕', category: 'local', tag: '[sticker:tea]' },
  { id: 'saps', label: 'CPF Watch', emoji: '🚔', category: 'safety', tag: '[sticker:saps]' },
  { id: 'geyser', label: 'Geyser Hot', emoji: '🚿', category: 'utilities', tag: '[sticker:geyser]' },
  { id: 'gate', label: 'Gate Remote', emoji: '🚧', category: 'co-living', tag: '[sticker:gate]' },
  { id: 'groceries', label: 'Groceries In', emoji: '🛒', category: 'co-living', tag: '[sticker:groceries]' },
  { id: 'package', label: 'Parcel Arrived', emoji: '📦', category: 'co-living', tag: '[sticker:package]' },
  { id: 'taxi', label: 'Taxi Rank', emoji: '🚐', category: 'local', tag: '[sticker:taxi]' },
  { id: 'vetkoek', label: 'Vetkoek Time', emoji: '🫓', category: 'local', tag: '[sticker:vetkoek]' },
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
