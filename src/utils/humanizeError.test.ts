import { test } from 'node:test'
import assert from 'node:assert/strict'
import { humanizeSupabaseError } from './humanizeError'

test('the commonest case tells a guest what is actually wrong', () => {
  // A guest or an expired session hits RLS constantly, and "row-level
  // security policy violation" tells them nothing they can act on.
  const out = humanizeSupabaseError(
    'new row violates row-level security policy for table "res_gossip_posts"'
  )
  assert.match(out, /guests can browse/i)
  assert.doesNotMatch(out, /res_gossip_posts/)
  assert.doesNotMatch(out, /row-level security/i)
})

test('an expired session is distinguished from a permission problem', () => {
  // These need different actions from the user — log in again vs. sign up.
  const expired = humanizeSupabaseError('JWT expired')
  assert.match(expired, /log in again/i)
  assert.notEqual(expired, humanizeSupabaseError('permission denied'))
})

test('each recognised failure maps to a distinct instruction', () => {
  const outputs = [
    'duplicate key value violates unique constraint',
    'violates foreign key constraint',
    'null value violates not-null constraint',
    'Failed to fetch',
    'too many requests'
  ].map(humanizeSupabaseError)

  assert.equal(new Set(outputs).size, outputs.length, 'messages should not collapse together')
  for (const out of outputs) {
    assert.doesNotMatch(out, /constraint/i)
  }
})

test('an unrecognised error is passed through rather than swallowed', () => {
  // Deliberate: a real-but-unmapped Postgres message is more useful to a
  // confused user, and to whoever they screenshot it to, than "something
  // went wrong". This is the opposite choice from unwrapDbError, which
  // guards messages shown in bulk UI — asserted so the difference is not
  // "fixed" by mistake later.
  const odd = 'function public.res_nonexistent(uuid) does not exist'
  assert.equal(humanizeSupabaseError(odd), odd)
})
