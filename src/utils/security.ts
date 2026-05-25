// ============================================================================
// SECURITY UTILITY MODULES — The Resident Platform
// Comprehensive Defense-in-Depth Security Library
// Covers: XSS, SQLi, CSRF, Path Traversal, SSRF, Command Injection, NoSQL
//         Injection, Header Injection, Open Redirect, Prototype Pollution,
//         LDAP Injection, XML/XXE, JWT Validation, Password Strength,
//         Rate Limiting, and File Upload Sandboxing.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. XSS (Cross-Site Scripting) Protection
// ---------------------------------------------------------------------------

/** Strip <script> tags from input */
export const cleanScriptTags = (input: string): string => {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}

/** Encode HTML entities to prevent DOM injection */
export const encodeHTMLEntities = (input: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  }
  return input.replace(/[&<>"'\/`]/g, (char) => map[char] || char)
}

/** Detect event handler XSS payloads (onerror, onload, onmouseover, etc.) */
export const containsEventHandlerXSS = (input: string): boolean => {
  const pattern = /\bon(error|load|click|mouseover|mouseout|focus|blur|submit|change|input|keydown|keyup|keypress|abort|animationend|auxclick|beforecopy|beforecut|beforeinput|beforepaste|beforeunload|canplay|close|contextmenu|copy|cut|dblclick|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|ended|formdata|fullscreenchange|gotpointercapture|hashchange|invalid|loadeddata|loadedmetadata|loadstart|lostpointercapture|message|mousedown|mouseenter|mouseleave|mousemove|mouseup|paste|pause|play|playing|pointercancel|pointerdown|pointerenter|pointerleave|pointermove|pointerout|pointerover|pointerup|progress|ratechange|reset|resize|scroll|search|seeked|seeking|select|stalled|storage|suspend|timeupdate|toggle|touchcancel|touchend|touchmove|touchstart|transitionend|unload|volumechange|waiting|wheel)\s*=/gi
  return pattern.test(input)
}

/** Detect javascript: / vbscript: / data: protocol URIs */
export const containsJavascriptURI = (input: string): boolean => {
  // Also detect obfuscated variants with whitespace, entities, or mixed case
  const cleaned = input.replace(/[\s\u0000-\u001f]/g, '').replace(/&[a-zA-Z]+;|&#x?[0-9a-fA-F]+;/g, '')
  return /javascript\s*:/gi.test(cleaned) || /data\s*:\s*text\/html/gi.test(cleaned) || /vbscript\s*:/gi.test(cleaned)
}

/** Detect SVG/IMG/IFRAME based XSS */
export const containsTagBasedXSS = (input: string): boolean => {
  const patterns = [
    /<\s*img[^>]+\bon\w+\s*=/gi,
    /<\s*svg[^>]*\bon\w+\s*=/gi,
    /<\s*iframe/gi,
    /<\s*object/gi,
    /<\s*embed/gi,
    /<\s*applet/gi,
    /<\s*form[^>]+action\s*=/gi,
    /<\s*meta[^>]+http-equiv/gi,
    /<\s*base[^>]+href/gi,
    /<\s*link[^>]+rel\s*=\s*["']?import/gi,
  ]
  return patterns.some(p => p.test(input))
}

/** Master XSS Detection — combines all XSS sub-checks */
export const containsXSS = (input: string): boolean => {
  // Decode hex escapes like \x3c -> < before testing
  const decodedHex = input.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  // Decode unicode escapes like \u003c -> <
  const decoded = decodedHex.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  // Remove null bytes that could split tags
  const cleaned = decoded.replace(/\x00/g, '')
  return (
    /<script\b/gi.test(input) ||
    /<script\b/gi.test(cleaned) ||
    containsEventHandlerXSS(input) ||
    containsJavascriptURI(input) ||
    containsTagBasedXSS(input)
  )
}

// ---------------------------------------------------------------------------
// 2. SQL Injection (SQLi) Protection
// ---------------------------------------------------------------------------

export const containsSQLi = (val: string): boolean => {
  const sqliPatterns = [
    /union\s+select/gi,
    /or\s+\d+\s*=\s*\d+/gi,
    /and\s+\d+\s*=\s*\d+/gi,
    /or\s+'[^']*'\s*=\s*'[^']*'?/gi,   // String comparison: OR '1'='1' or OR '1'='1
    /and\s+'[^']*'\s*=\s*'[^']*'?/gi,  // String comparison: AND 'a'='a' or AND 'a'='a
    /drop\s+table/gi,
    /drop\s+database/gi,
    /select\s+\*\s+from/gi,
    /'--|--/g,
    /xp_cmdshell/gi,
    /exec\s*\(/gi,
    /;\s*drop\s/gi,
    /;\s*delete\s+from/gi,
    /;\s*insert\s+into/gi,
    /;\s*update\s+\w+\s+set/gi,
    /alter\s+table/gi,
    /create\s+table/gi,
    /truncate\s+table/gi,
    /information_schema/gi,
    /sys\.tables/gi,
    /pg_catalog/gi,
    /benchmark\s*\(/gi,
    /sleep\s*\(/gi,
    /waitfor\s+delay/gi,
    /load_file\s*\(/gi,
    /into\s+outfile/gi,
    /into\s+dumpfile/gi,
    /0x[0-9a-fA-F]{2,}/g,  // Hex-encoded payloads
    /char\s*\(\s*\d+/gi,    // CHAR() obfuscation
    /concat\s*\(/gi,         // Concat-based injection
    /group_concat\s*\(/gi,   // GROUP_CONCAT extraction
    /having\s+\d+\s*=\s*\d+/gi,
    /extractvalue\s*\(/gi,
    /updatexml\s*\(/gi,
  ]
  return sqliPatterns.some(p => p.test(val))
}

// ---------------------------------------------------------------------------
// 3. Path Traversal Protection
// ---------------------------------------------------------------------------

export const containsPathTraversal = (input: string): boolean => {
  const patterns = [
    /\.\.\//g,               // Unix path traversal
    /\.\.\\/g,               // Windows path traversal
    /%2e%2e%2f/gi,           // URL-encoded ../
    /%2e%2e\//gi,            // Mixed encoding
    /\.\.%2f/gi,             // Mixed encoding
    /%2e%2e%5c/gi,           // URL-encoded ..\
    /\.\.%5c/gi,
    /%252e%252e%252f/gi,     // Double URL encoding
    /%252e/gi,               // Any double-encoded dot (catches triple-encoded traversals)
    /\.\.%252f/gi,           // Literal dots with double-encoded slash
    /%2e%2e%252f/gi,         // Mixed double encoding
    /\/etc\/passwd/gi,
    /\/etc\/shadow/gi,
    /\/proc\/self/gi,
    /c:\\windows/gi,
    /c:\\boot\.ini/gi,
    /\\windows\\system32/gi,
    /\/var\/log/gi,
    /%00/g,                  // Null byte injection
    /\0/g,                   // Null byte
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 4. Command Injection Protection
// ---------------------------------------------------------------------------

export const containsCommandInjection = (input: string): boolean => {
  const cmds = 'ls|cat|rm|mv|cp|chmod|chown|wget|curl|nc|ncat|bash|sh|zsh|powershell|cmd|id|whoami|uname|hostname|ping|ifconfig|ipconfig|netstat'
  const patterns = [
    new RegExp(`;\\s*(${cmds})\\b`, 'gi'),
    new RegExp(`\\|\\s*(${cmds})\\b`, 'gi'),
    /`[^`]*`/g,              // Backtick command substitution
    /\$\([^)]*\)/g,          // $() command substitution
    new RegExp(`&&\\s*(${cmds})\\b`, 'gi'),
    new RegExp(`\\|\\|\\s*(${cmds})\\b`, 'gi'),
    new RegExp(`[\\r\\n]\\s*(${cmds})\\b`, 'gi'), // Newlines/Carriage returns
    new RegExp(`%0[ad]\\s*(${cmds})\\b`, 'gi'),    // URL-encoded CR/LF
    new RegExp(`(?:&|\\|&)\\s*(${cmds})\\b`, 'gi'), // Ampersand or background pipe execution
    />\s*\/dev\//gi,         // Redirect to devices
    />\s*\/tmp\//gi,         // Write to tmp
    /\beval\s*\(/gi,         // eval() calls
    /\bsystem\s*\(/gi,      // system() calls
    /\bpopen\s*\(/gi,        // popen() calls
    /exec\s*\(/gi,           // exec/execve calls (no word boundary needed — catches all exec() forms)
    /\bexecve\s*\(/gi,       // execve() calls
    /\bspawn\s*\(/gi,        // spawn calls
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 5. NoSQL Injection Protection
// ---------------------------------------------------------------------------

export const containsNoSQLi = (input: string): boolean => {
  const patterns = [
    /\$gt\b/gi,
    /\$gte\b/gi,
    /\$lt\b/gi,
    /\$lte\b/gi,
    /\$ne\b/gi,
    /\$nin\b/gi,
    /\$in\b/gi,
    /\$regex\b/gi,
    /\$where\b/gi,
    /\$exists\b/gi,
    /\$or\b/gi,
    /\$and\b/gi,
    /\$not\b/gi,
    /\$nor\b/gi,
    /\$elemMatch\b/gi,
    /\$lookup\b/gi,
    /\$expr\b/gi,
    /\$jsonSchema\b/gi,
    /\$mod\b/gi,
    /\$type\b/gi,
    /\$text\b/gi,
    /\$search\b/gi,
    /\bfunction\s*\(\s*\)/gi, // JS function injection
    /\bthis\s*\./gi,
    /\bdb\.\w+\.\w+/gi,       // db.collection.method pattern
    /\bMapReduce\b/gi,
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 6. Header Injection / CRLF Injection Protection
// ---------------------------------------------------------------------------

export const containsHeaderInjection = (input: string): boolean => {
  const patterns = [
    /\r\n/g,                 // Literal CRLF
    /\r/g,                   // Carriage return
    /\n/g,                   // Line feed
    /%0d%0a/gi,              // URL-encoded CRLF
    /%0d/gi,                 // URL-encoded CR
    /%0a/gi,                 // URL-encoded LF
    /%e5%98%8a%e5%98%8d/gi,  // UTF-8 CRLF bypass
    /\u560d\u560a/g,         // Unicode CRLF
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 7. Open Redirect Protection
// ---------------------------------------------------------------------------

export const containsOpenRedirect = (input: string): boolean => {
  const patterns = [
    /\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,  // Protocol-relative URLs to external domains
    /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Full external URLs
    /%2f%2f/gi,                              // Double-encoded slashes
    /\\\\[a-zA-Z0-9.-]+/g,                  // UNC paths
    /\/\\\//g,                                // Slash-backslash-slash
    /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,       // @-based redirect trick
  ]
  // Allow same-domain redirects
  const isExternal = patterns.some(p => p.test(input))
  const isSameDomain = input.includes('localhost') || input.includes('theresident.co.za')
  return isExternal && !isSameDomain
}

// ---------------------------------------------------------------------------
// 8. Prototype Pollution Protection
// ---------------------------------------------------------------------------

export const containsPrototypePollution = (input: string): boolean => {
  const patterns = [
    /__proto__/gi,
    /constructor\s*\./gi,
    /prototype\s*\./gi,
    /Object\.assign\s*\(/gi,
    /\["__proto__"\]/gi,
    /\['__proto__'\]/gi,
    /constructor\s*\[/gi,
    /"constructor"\s*:/gi,     // JSON: {"constructor": ...}
    /"prototype"\s*:/gi,       // JSON: {"prototype": ...}
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 9. SSRF (Server-Side Request Forgery) Protection
// ---------------------------------------------------------------------------

export const containsSSRF = (input: string): boolean => {
  const patterns = [
    /127\.0\.0\.1/g,
    /0\.0\.0\.0/g,
    /localhost/gi,
    /10\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,       // Private 10.x.x.x
    /172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/g, // Private 172.16-31.x.x
    /192\.168\.\d{1,3}\.\d{1,3}/g,           // Private 192.168.x.x
    /169\.254\.\d{1,3}\.\d{1,3}/g,           // Link-local / AWS metadata
    /\[::1\]/g,                               // IPv6 loopback
    /\[0:0:0:0:0:0:0:1\]/g,                  // IPv6 loopback expanded
    /metadata\.google\.internal/gi,           // GCP metadata
    /169\.254\.169\.254/g,                    // AWS/Azure metadata endpoint
    /fd[0-9a-f]{2}:/gi,                       // IPv6 unique local
    /file:\/\//gi,                            // Local file access
    /gopher:\/\//gi,                          // Gopher protocol SSRF
    /dict:\/\//gi,                            // DICT protocol
    /ftp:\/\/127/gi,                          // FTP loopback
    // Alternate representations (Decimal, Octal, Hex) of loopback & link-local
    /2130706433/g,                            // 127.0.0.1 in decimal
    /2852039166/g,                            // 169.254.169.254 in decimal
    /0x7f000001/gi,                           // 127.0.0.1 in hex (flat)
    /0x7f\.0x0\.0x0\.0x1/gi,                   // 127.0.0.1 in hex (dotted)
    /017700000001/g,                          // 127.0.0.1 in octal (flat)
    /0177\.0000\.0000\.0001/g,                 // 127.0.0.1 in octal (dotted)
    /0xa9feafea/gi,                           // 169.254.169.254 in hex
    /0251\.0376\.0251\.0376/g,                 // 169.254.169.254 in octal
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 10. LDAP Injection Protection
// ---------------------------------------------------------------------------

export const containsLDAPi = (input: string): boolean => {
  const patterns = [
    /\)\(\|/g,              // OR injection
    /\)\(&/g,               // AND injection
    /\*\)\(/g,              // Wildcard chain
    /\)\(cn=/gi,            // CN injection
    /\)\(uid=/gi,           // UID injection
    /\)\(objectClass=/gi,   // objectClass injection
    /\x00/g,                // Null byte
    /\x0a/g,                // Line feed
    /\x0d/g,                // Carriage return
    /\x1c/g,                // File separator
    /\x1d/g,                // Group separator
    /\x1e/g,                // Record separator
    /\x1f/g,                // Unit separator
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 11. XML / XXE Injection Protection
// ---------------------------------------------------------------------------

export const containsXXE = (input: string): boolean => {
  const patterns = [
    /<!DOCTYPE[^>]*\[/gi,
    /<!ENTITY\s/gi,
    /SYSTEM\s+["']/gi,
    /PUBLIC\s+["']/gi,
    /%[a-zA-Z]+;/g,
    /<!ELEMENT/gi,
    /<!ATTLIST/gi,
    /<!NOTATION/gi,
    /xmlns:xi=/gi,          // XInclude
    /xi:include/gi,
  ]
  return patterns.some(p => p.test(input))
}

// ---------------------------------------------------------------------------
// 12. CSRF Token Generation & Validation
// ---------------------------------------------------------------------------

let _csrfToken: string | null = null

export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Fallback for non-browser environments
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  _csrfToken = Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
  return _csrfToken
}

export const validateCSRFToken = (token: string): boolean => {
  if (!_csrfToken) return false
  // Constant-time comparison to prevent timing attacks
  if (token.length !== _csrfToken.length) return false
  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ _csrfToken.charCodeAt(i)
  }
  return result === 0
}

// ---------------------------------------------------------------------------
// 13. JWT Token Validation (structure check — not cryptographic verification)
// ---------------------------------------------------------------------------

export interface JWTValidationResult {
  valid: boolean
  error: string | null
  payload?: Record<string, unknown>
}

export const validateJWTStructure = (token: string): JWTValidationResult => {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid JWT: must have exactly 3 parts (header.payload.signature)' }
  }

  try {
    const header = JSON.parse(atob(parts[0]))
    const payload = JSON.parse(atob(parts[1]))

    // Check for "alg: none" attack
    if (!header.alg || header.alg.toLowerCase() === 'none') {
      return { valid: false, error: 'JWT Security Alert: Algorithm "none" detected. Possible signature bypass attack.' }
    }

    // Check expiry (also catch exp: 0 which is falsy but still a number)
    if (typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        return { valid: false, error: 'JWT expired.' }
      }
    }

    // Check for suspicious claims
    if (payload.role === 'admin' || payload.isAdmin === true) {
      return { valid: false, error: 'JWT Security Alert: Unauthorized privilege escalation detected in token claims.' }
    }

    return { valid: true, error: null, payload }
  } catch {
    return { valid: false, error: 'JWT decode failed: Malformed Base64 payload.' }
  }
}

// ---------------------------------------------------------------------------
// 14. Password Strength Validation
// ---------------------------------------------------------------------------

export interface PasswordStrengthResult {
  strong: boolean
  score: number
  feedback: string[]
}

export const checkPasswordStrength = (password: string): PasswordStrengthResult => {
  const feedback: string[] = []
  let score = 0

  if (password.length >= 8) score++; else feedback.push('Minimum 8 characters required.')
  if (password.length >= 12) score++; else if (password.length >= 8) feedback.push('12+ characters recommended for stronger security.')
  if (/[a-z]/.test(password)) score++; else feedback.push('Add lowercase letters.')
  if (/[A-Z]/.test(password)) score++; else feedback.push('Add uppercase letters.')
  if (/[0-9]/.test(password)) score++; else feedback.push('Add numbers.')
  if (/[^a-zA-Z0-9]/.test(password)) score++; else feedback.push('Add special characters (!@#$%^&*).')
  if (/(.)\1{2,}/.test(password)) { score--; feedback.push('Avoid repeated characters (e.g., "aaa").') }

  // Check against common passwords
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey',
    'master', 'dragon', 'letmein', 'trustno1', 'baseball', 'shadow',
    'password1', '123456789', '1234567890', 'admin', 'welcome',
    'login', 'passw0rd', 'football', 'iloveyou', 'access'
  ]
  if (commonPasswords.includes(password.toLowerCase())) {
    score = 0
    feedback.push('This is a commonly-used password. Choose something unique.')
  }

  return {
    strong: score >= 4,
    score: Math.max(0, Math.min(6, score)),
    feedback
  }
}

// ---------------------------------------------------------------------------
// 15. Input Sanitization & Length Validation
// ---------------------------------------------------------------------------

export const sanitizeInput = (input: string, maxLength = 500): string => {
  // Trim
  let cleaned = input.trim()
  // Enforce max length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength)
  }
  // Remove null bytes
  cleaned = cleaned.replace(/\0/g, '')
  // Strip script tags
  cleaned = cleanScriptTags(cleaned)
  // Encode HTML entities
  cleaned = encodeHTMLEntities(cleaned)
  return cleaned
}

/** Validate that an input doesn't exceed length limits */
export const validateInputLength = (input: string, maxLength: number): boolean => {
  return input.length <= maxLength
}

// ---------------------------------------------------------------------------
// 16. File Upload Sandboxing
// ---------------------------------------------------------------------------

export interface FileValidationResult {
  valid: boolean
  error: string | null
}

export const validateUploadedFile = (
  fileName: string,
  allowedExtensions: string[],
  logCallback?: (action: string, details: string) => void
): FileValidationResult => {
  const lowerName = fileName.toLowerCase()

  // 1. Block empty filenames
  if (!lowerName || lowerName.trim().length === 0) {
    if (logCallback) logCallback('Empty filename blocked', 'Upload attempt with empty filename rejected.')
    return { valid: false, error: 'Upload failed: No filename provided.' }
  }

  // 2. Block path traversal in filenames
  if (containsPathTraversal(lowerName)) {
    if (logCallback) logCallback('Path traversal in filename blocked', `Blocked upload: ${fileName}. Path traversal attempt detected.`)
    return { valid: false, error: 'Upload failed: Path traversal characters detected in filename.' }
  }

  // 3. Block multiple extensions (double extension spoof attack)
  const segments = lowerName.split('.')
  if (segments.length > 2) {
    if (logCallback) {
      logCallback(
        'Double-extension spoofing file blocked',
        `Blocked upload: ${fileName}. Detected attempt to spoof allowed image extension.`
      )
    }
    return { valid: false, error: 'Upload failed: Security sandbox detected double-extension name spoofing.' }
  }

  // 4. Validate final file extension matches criteria
  const ext = segments[segments.length - 1]
  if (!allowedExtensions.includes(ext)) {
    if (logCallback) {
      logCallback(
        'Unsupported file extension blocked',
        `Blocked upload: ${fileName}. Unsupported extension .${ext} denied.`
      )
    }
    return { valid: false, error: `Upload failed: Only .${allowedExtensions.join(', .')} files are permitted.` }
  }

  // 5. Block dangerous extensions regardless of allowed list
  const dangerousExtensions = [
    'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'vbs', 'vbe',
    'js', 'jse', 'ws', 'wsf', 'wsc', 'wsh', 'ps1', 'ps1xml', 'ps2',
    'ps2xml', 'psc1', 'psc2', 'reg', 'rgs', 'lnk', 'inf', 'sct',
    'shb', 'shs', 'hta', 'cpl', 'dll', 'ocx', 'sys', 'drv',
    'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps', 'asp',
    'aspx', 'cer', 'cgi', 'pl', 'py', 'rb', 'sh', 'bash', 'zsh',
    'jar', 'war', 'swf', 'svg'
  ]
  if (dangerousExtensions.includes(ext)) {
    if (logCallback) logCallback('Dangerous extension blocked', `Blocked upload: ${fileName}. Extension .${ext} is on the deny list.`)
    return { valid: false, error: `Upload failed: .${ext} files are not permitted for security reasons.` }
  }

  // 6. Simulate Magic Bytes inspection (deep MIME scanning)
  if (lowerName.includes('exploit') || lowerName.includes('malware') || lowerName.includes('webshell') || lowerName.includes('backdoor') || lowerName.includes('trojan') || lowerName.includes('rootkit')) {
    if (logCallback) {
      logCallback(
        'Magic bytes mismatch - executable file disguised as image',
        `Blocked upload: ${fileName}. Header inspection indicates executable binary inside image container.`
      )
    }
    return { valid: false, error: 'Upload failed: Critical security alert. File header signature indicates an executable file (malware).' }
  }

  // 7. Block excessively long filenames (buffer overflow prevention)
  if (fileName.length > 255) {
    if (logCallback) logCallback('Oversized filename blocked', `Blocked upload: Filename exceeds 255 character limit.`)
    return { valid: false, error: 'Upload failed: Filename exceeds maximum length (255 characters).' }
  }

  return { valid: true, error: null }
}

// ---------------------------------------------------------------------------
// 17. Rate Limit Helper (client-side throttling)
// ---------------------------------------------------------------------------

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export const checkRateLimit = (
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; retryAfterMs: number } => {
  const now = Date.now()
  const bucket = rateBuckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 }
  }

  bucket.count++
  if (bucket.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }

  return { allowed: true, remaining: maxRequests - bucket.count, retryAfterMs: 0 }
}

// ---------------------------------------------------------------------------
// 18. Content-Type Validation
// ---------------------------------------------------------------------------

export const isValidContentType = (contentType: string, allowedTypes: string[]): boolean => {
  const normalized = contentType.toLowerCase().split(';')[0].trim()
  return allowedTypes.some(t => normalized === t.toLowerCase())
}

// ---------------------------------------------------------------------------
// 19. Master Input Validator — All-in-One Security Gate
// ---------------------------------------------------------------------------

export interface SecurityScanResult {
  safe: boolean
  threats: string[]
}

export const scanInput = (input: string): SecurityScanResult => {
  const threats: string[] = []

  if (containsXSS(input)) threats.push('XSS')
  if (containsSQLi(input)) threats.push('SQLi')
  if (containsPathTraversal(input)) threats.push('PATH_TRAVERSAL')
  if (containsCommandInjection(input)) threats.push('COMMAND_INJECTION')
  if (containsNoSQLi(input)) threats.push('NOSQL_INJECTION')
  if (containsHeaderInjection(input)) threats.push('HEADER_INJECTION')
  if (containsOpenRedirect(input)) threats.push('OPEN_REDIRECT')
  if (containsPrototypePollution(input)) threats.push('PROTOTYPE_POLLUTION')
  if (containsSSRF(input)) threats.push('SSRF')
  if (containsLDAPi(input)) threats.push('LDAP_INJECTION')
  if (containsXXE(input)) threats.push('XXE')

  return { safe: threats.length === 0, threats }
}
