import test from 'node:test'
import assert from 'node:assert/strict'
import { RESIDENT_STICKERS, getStickerByTag, STICKER_MAP } from './residentStickers'

test('resident stickers are safely defined and mapped', () => {
  assert.ok(RESIDENT_STICKERS.length >= 10, 'Expected at least 10 in-app stickers')
  for (const s of RESIDENT_STICKERS) {
    assert.ok(s.id, 'Sticker must have an id')
    assert.ok(s.tag.startsWith('[sticker:'), 'Sticker tag must follow convention')
    assert.equal(getStickerByTag(s.tag)?.id, s.id, 'getStickerByTag must resolve correctly')
  }
})

test('getStickerByTag rejects unsafe tags', () => {
  assert.equal(getStickerByTag('<script>'), undefined)
  assert.equal(getStickerByTag('[sticker:unknown_xyz]'), undefined)
  assert.equal(getStickerByTag(''), undefined)
})
