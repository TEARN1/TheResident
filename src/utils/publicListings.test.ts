import { test } from 'node:test'
import assert from 'node:assert'
import { publicListingToListing, listingShareText, whatsappShareUrl, type PublicListingRow } from './publicListings'

const row: PublicListingRow = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Room near Wits',
  description: null,
  price: '4500',
  currency: 'ZAR',
  suburb: 'Braamfontein',
  city: 'Johannesburg',
  images: null,
  wifi: true,
  parking: null,
  bathroom: 'ensuite',
  landlord_lives_here: false,
  listing_type: 'rent',
  quick_post: false,
  event_id: null,
  featured_until: null,
  last_verified_at: null,
  flagged: true,
  flag_reason: 'Priced far below the suburb median',
  created_at: '2026-10-01T00:00:00Z'
}

test('publicListingToListing maps safe columns and never invents a landlord', () => {
  const l = publicListingToListing(row)
  assert.strictEqual(l.price, 4500)
  assert.strictEqual(l.landlordId, '')
  assert.strictEqual(l.location, 'Braamfontein, Johannesburg')
  assert.strictEqual(l.amenities.bathroom, 'ensuite')
  assert.strictEqual(l.amenities.parking, false)
  assert.deepStrictEqual(l.images, [])
  assert.strictEqual(l.lastVerifiedAt, undefined)
  assert.strictEqual(l.safetyNotes, 'Priced far below the suburb median')
})

test('publicListingToListing falls back to shared bathroom and rent type', () => {
  const l = publicListingToListing({ ...row, bathroom: 'weird', listing_type: null })
  assert.strictEqual(l.amenities.bathroom, 'shared')
  assert.strictEqual(l.listingType, 'rent')
})

test('listingShareText states price, period and suburb', () => {
  const text = listingShareText({ title: 'Room near Wits', price: 4500, currency: 'ZAR', suburb: 'Braamfontein', listingType: 'rent' }, 'https://x/rooms/1')
  assert.match(text, /Room near Wits — R\s?4[\s,.]?500\/mo in Braamfontein/)
  assert.match(text, /https:\/\/x\/rooms\/1$/)
})

test('whatsappShareUrl encodes the message', () => {
  assert.strictEqual(whatsappShareUrl('a b&c'), 'https://wa.me/?text=a%20b%26c')
})

test('conciergeWhatsAppUrl needs a number and names the area', async () => {
  const { conciergeWhatsAppUrl } = await import('./launch')
  assert.strictEqual(conciergeWhatsAppUrl('Braamfontein', ''), null)
  const url = conciergeWhatsAppUrl('Braamfontein', '27821234567')!
  assert.match(url, /^https:\/\/wa\.me\/27821234567\?text=/)
  assert.match(decodeURIComponent(url), /list a room in Braamfontein/)
})
