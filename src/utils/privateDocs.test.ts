import assert from 'node:assert/strict'
import { isPrivateDocRef, privateDocPath, PRIVATE_DOC_BUCKET } from './privateDocs'

// Files go under the uploader's own id, so the bucket's rules can check them,
// and the user's file name never becomes part of the path.
const p = privateDocPath('11111111-2222-3333-4444-555555555555', 'properties', 'My Lease (final).PDF', 42)
assert.equal(p, '11111111-2222-3333-4444-555555555555/properties/42.pdf')
assert.equal(privateDocPath('u1', 'selfie', '../../etc/passwd', 1), 'u1/selfie/1.etcpassw')
assert.equal(privateDocPath('u1', 'selfie', 'noext', 1), 'u1/selfie/1.noext')

assert.equal(PRIVATE_DOC_BUCKET, 'res-verification')
assert.ok(isPrivateDocRef('res-verification/u1/selfie/1.jpg'))
assert.ok(!isPrivateDocRef('https://x.supabase.co/storage/v1/object/public/gossip-media/u1/a.jpg'))
assert.ok(!isPrivateDocRef(null))

console.log('# fail 0 (privateDocs)')
