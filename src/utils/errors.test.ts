import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getErrorMessage, unwrapDbError } from './errors'

test('getErrorMessage handles what Supabase actually throws', () => {
  // A PostgrestError is a plain object, not an Error, so String(err) on one
  // yields "[object Object]" — the bug this function exists to prevent.
  const postgrest = { message: 'duplicate key value', code: '23505', details: null }
  assert.equal(getErrorMessage(postgrest), 'duplicate key value')
  assert.equal(getErrorMessage(new Error('boom')), 'boom')
  assert.doesNotMatch(getErrorMessage(postgrest), /\[object Object\]/)
})

test('getErrorMessage never returns undefined for odd inputs', () => {
  for (const input of [null, undefined, 42, '', { nope: true }]) {
    assert.equal(typeof getErrorMessage(input), 'string')
  }
})

test('unwrapDbError never leaks table, column or policy names to a user', () => {
  // THE POINT OF THIS FUNCTION. A raw Postgres error names internal schema,
  // which is information disclosure — and meaningless to a resident anyway.
  const leaky = [
    'new row violates row-level security policy "res_listings_insert" for table "res_listings"',
    'permission denied for table res_org_unit_billing',
    'duplicate key value violates unique constraint "res_home_areas_pkey"',
    'insert or update on table "res_rooms" violates foreign key constraint "res_rooms_property_id_fkey"'
  ]
  for (const raw of leaky) {
    const out = unwrapDbError(raw)
    assert.doesNotMatch(out, /res_/, raw)
    assert.doesNotMatch(out, /table/i, raw)
    assert.doesNotMatch(out, /constraint|policy/i, raw)
    assert.ok(out.length > 0)
  }
})

test('unwrapDbError says something useful rather than only something safe', () => {
  assert.match(unwrapDbError('violates row-level security policy'), /permission/i)
  assert.match(unwrapDbError('duplicate key value'), /already exists/i)
  assert.match(unwrapDbError('rate limit exceeded'), /too many/i)
  assert.match(unwrapDbError('fetch failed'), /network/i)
})

test('unwrapDbError falls back to a generic message, not to the raw error', () => {
  const out = unwrapDbError('ERROR: syntax error at or near "SELECT" at character 42')
  assert.doesNotMatch(out, /SELECT/)
  assert.doesNotMatch(out, /character 42/)
  assert.match(out, /something went wrong/i)
})
