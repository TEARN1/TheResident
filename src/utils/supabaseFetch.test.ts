import test from 'node:test'
import assert from 'node:assert'
import { createTimeoutFetch, shouldTimeOut, REQUEST_TIMEOUT_MS } from './supabaseFetch'

const url = 'https://example.supabase.co/rest/v1/res_gossip_posts'

test('a request that never answers is aborted rather than waited on forever', async () => {
  // The exact failure this exists for: the socket is open, the server has the
  // request, and nothing ever comes back. A finally never runs, so the
  // loading state never clears.
  const hang: typeof fetch = () => new Promise(() => {})
  const f = createTimeoutFetch(hang, 30)
  await assert.rejects(() => f(url), /took too long/)
})

test('the timeout message is one a resident can act on', async () => {
  const hang: typeof fetch = () => new Promise(() => {})
  const f = createTimeoutFetch(hang, 20)
  await assert.rejects(() => f(url), (e: Error) => {
    assert.ok(!/abort/i.test(e.message), `leaked an abort message: ${e.message}`)
    assert.match(e.message, /connection/i)
    return true
  })
})

test('a normal response is passed straight through', async () => {
  const ok: typeof fetch = async () => new Response('{}', { status: 200 })
  const f = createTimeoutFetch(ok, 1000)
  assert.strictEqual((await f(url)).status, 200)
})

test('a real error is not disguised as a timeout', async () => {
  const boom: typeof fetch = async () => { throw new TypeError('network down') }
  const f = createTimeoutFetch(boom, 1000)
  await assert.rejects(() => f(url), /network down/)
})

// Aborting a websocket handshake on a timer would break realtime and, worse,
// silently log people out when a token refresh was cut short.
test('realtime and auth traffic is exempt', () => {
  assert.strictEqual(shouldTimeOut('https://x.supabase.co/realtime/v1/websocket'), false)
  assert.strictEqual(shouldTimeOut('https://x.supabase.co/auth/v1/token'), false)
  assert.strictEqual(shouldTimeOut('https://x.supabase.co/rest/v1/res_listings'), true)
  assert.strictEqual(shouldTimeOut('https://x.supabase.co/storage/v1/object/x'), true)
})

test("a caller's own abort still works, and is not relabelled as a timeout", async () => {
  const hang: typeof fetch = (_i, init) => new Promise((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
  })
  const f = createTimeoutFetch(hang, 5000)
  const ac = new AbortController()
  const p = f(url, { signal: ac.signal })
  ac.abort()
  await assert.rejects(() => p, (e: Error) => {
    assert.ok(!/took too long/.test(e.message),
      'the caller aborted deliberately; calling that a timeout would be a lie')
    return true
  })
})

test('the deadline is long enough for a slow connection', () => {
  assert.ok(REQUEST_TIMEOUT_MS >= 10000 && REQUEST_TIMEOUT_MS <= 30000,
    `${REQUEST_TIMEOUT_MS}ms will cut off real users on a bad signal`)
})
