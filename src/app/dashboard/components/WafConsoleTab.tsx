import React from 'react'
import { motion } from 'framer-motion'
import { Terminal, Zap, Shield, FileCode, Upload, Info } from 'lucide-react'
import { t } from '../../../utils/i18n'

interface LogEntry {
  id: string
  timestamp: string
  type: string
  action: string
  details: string
}

interface WafConsoleTabProps {
  securityLogs: LogEntry[]
  runHackSimulation: (type: 'xss' | 'idor' | 'flood' | 'sqli' | 'traversal' | 'cmdi' | 'ssrf' | 'nosqli') => void
  runScaleStressTest: (type: string) => void
  networkKilled: boolean
  setNetworkKilled: (val: boolean) => void
  setAlertNotification: (val: string | null) => void
  stressTestOutput: string | null
  sanitizationInput: string
  handleSanitizationCheck: (val: string) => void
  sanitizationOutput: string
  triggerMockUpload: (filename: string, category: 'listing' | 'document') => void
  hackPayload: string
  setHackPayload: (val: string) => void
  hackFeedback: string | null
  hackFeedbackType: 'success' | 'error' | 'warning'
  lang: 'en' | 'zu' | 'xh' | 'af'
  styles: Record<string, React.CSSProperties>
  consolePanelStyle?: React.CSSProperties
  consoleHeaderStyle?: React.CSSProperties
  consoleTitleWrapperStyle?: React.CSSProperties
  consolePulseStyle?: React.CSSProperties
  consoleDescStyle?: React.CSSProperties
  hackButtonsRowStyle?: React.CSSProperties
  hackBtnStyle?: React.CSSProperties
  wafContainerStyle?: React.CSSProperties
  logTitleStyle?: React.CSSProperties
  wafFlowContainerStyle?: React.CSSProperties
  wafVisualFlowStyle?: React.CSSProperties
  wafPacketStyle?: React.CSSProperties
  wafLineStyle?: React.CSSProperties
  wafStatusGridStyle?: React.CSSProperties
  wafNodeStyle?: React.CSSProperties
  wafNodeIndicatorStyle?: React.CSSProperties
  wafNodeLabelStyle?: React.CSSProperties
  playgroundGroupStyle?: React.CSSProperties
  consoleTextareaStyle?: React.CSSProperties
  sanitizationOutputBoxStyle?: React.CSSProperties
  sanLabelStyle?: React.CSSProperties
  sanValueStyle?: React.CSSProperties
  consoleInputStyle?: React.CSSProperties
  logConsoleStyle?: React.CSSProperties
  logScrollAreaStyle?: React.CSSProperties
  logEmptyStyle?: React.CSSProperties
  logLineStyleStyle: (type: string) => React.CSSProperties
  logTimeStyle?: React.CSSProperties
  logTypeLabelStyle?: React.CSSProperties
  feedbackBoxStyleStyle: (type: 'success' | 'warning' | 'error') => React.CSSProperties
}

export default function WafConsoleTab({
  securityLogs,
  runHackSimulation,
  runScaleStressTest,
  networkKilled,
  setNetworkKilled,
  setAlertNotification,
  stressTestOutput,
  sanitizationInput,
  handleSanitizationCheck,
  sanitizationOutput,
  triggerMockUpload,
  hackPayload,
  setHackPayload,
  hackFeedback,
  hackFeedbackType,
  lang,
  styles,
  consolePanelStyle,
  consoleHeaderStyle,
  consoleTitleWrapperStyle,
  consolePulseStyle,
  consoleDescStyle,
  hackButtonsRowStyle,
  hackBtnStyle,
  wafContainerStyle,
  logTitleStyle,
  wafFlowContainerStyle,
  wafVisualFlowStyle,
  wafPacketStyle,
  wafLineStyle,
  wafStatusGridStyle,
  wafNodeStyle,
  wafNodeIndicatorStyle,
  wafNodeLabelStyle,
  playgroundGroupStyle,
  consoleTextareaStyle,
  sanitizationOutputBoxStyle,
  sanLabelStyle,
  sanValueStyle,
  consoleInputStyle,
  logConsoleStyle,
  logScrollAreaStyle,
  logEmptyStyle,
  logLineStyleStyle,
  logTimeStyle,
  logTypeLabelStyle,
  feedbackBoxStyleStyle
}: WafConsoleTabProps) {
  const latestLog = securityLogs[0]
  const isLastSqli = latestLog?.type === 'sqli_blocked'
  const isLastXss = latestLog?.type === 'xss_blocked'
  const isLastIdor = latestLog?.type === 'idor_prevented'
  const isLastRate = latestLog?.type === 'rate_limit_triggered'
  const isLastMalware = latestLog?.type === 'upload_malware_blocked'

  return (
    <div style={consolePanelStyle}>
      <div style={consoleHeaderStyle}>
        <div style={consoleTitleWrapperStyle}>
          <Terminal size={14} color="#D4AF37" />
          <span>{t('securityLabs', lang)}</span>
        </div>
        <span style={consolePulseStyle} />
      </div>
      
      <p style={consoleDescStyle}>
        {t('securityLabsDesc', lang)}
      </p>

      {/* Hacking Simulator buttons */}
      <div style={hackButtonsRowStyle}>
        <button 
          onClick={() => runHackSimulation('xss')}
          style={hackBtnStyle}
          title="Simulate Cross-Site Scripting Injection"
        >
          1. XSS Injection (Input Script Attack)
        </button>
        <button 
          onClick={() => runHackSimulation('idor')}
          style={hackBtnStyle}
          title="Simulate Insecure Direct Object Reference"
        >
          2. IDOR Privilege Bypass (Record Hijack)
        </button>
        <button 
          onClick={() => runHackSimulation('flood')}
          style={hackBtnStyle}
          title="Simulate API brute-force DOS flood"
        >
          3. API Flood DDoS (Rate limit triggers)
        </button>
        <button 
          onClick={() => runHackSimulation('sqli')}
          style={hackBtnStyle}
          title="Simulate SQL Injection query parameters block"
        >
          4. SQL Injection (UNION SELECT Query)
        </button>
        <button 
          onClick={() => runHackSimulation('traversal')}
          style={hackBtnStyle}
          title="Simulate Directory/Path Traversal Attack"
        >
          5. Path Traversal (Access System Files)
        </button>
        <button 
          onClick={() => runHackSimulation('cmdi')}
          style={hackBtnStyle}
          title="Simulate OS Command Injection Attack"
        >
          6. Command Injection (Shell Execution)
        </button>
        <button 
          onClick={() => runHackSimulation('ssrf')}
          style={hackBtnStyle}
          title="Simulate Server-Side Request Forgery Attack"
        >
          7. SSRF Attack (Internal Network Scan)
        </button>
        <button 
          onClick={() => runHackSimulation('nosqli')}
          style={hackBtnStyle}
          title="Simulate MongoDB/NoSQL Operator Injection"
        >
          8. NoSQL Injection (Operator Bypass)
        </button>
      </div>

      <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px dashed rgba(212, 175, 55, 0.3)', textAlign: 'left' }}>
        <div style={consoleHeaderStyle}>
          <div style={consoleTitleWrapperStyle}>
            <Zap size={14} color="#D4AF37" />
            <span style={{ fontWeight: 'bold' }}>{t('scaleStressTestHub', lang)}</span>
          </div>
        </div>
        <p style={consoleDescStyle}>
          {t('scaleStressTestDesc', lang)}
        </p>

        {/* Stress Test Trigger Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
          <button 
            onClick={() => runScaleStressTest('jwt_expiry')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            ⚡ JWT Expiry Under Load
          </button>
          <button 
            onClick={() => runScaleStressTest('optimistic_rollback')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            🔄 Optimistic UI Rollback
          </button>
          <button 
            onClick={() => runScaleStressTest('realtime_reconnect')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            🔌 Realtime Reconnection
          </button>
          <button 
            onClick={() => runScaleStressTest('storage_performance')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            📦 Storage Performance
          </button>
          <button 
            onClick={() => runScaleStressTest('search_debounce')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            🔍 Search Debounce (20M/500ms)
          </button>
          <button 
            onClick={() => runScaleStressTest('notification_flood')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            🔔 Notification Flood (500M)
          </button>
          <button 
            onClick={() => runScaleStressTest('deep_pagination')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            📑 Deep Pagination Slowdown
          </button>
          <button 
            onClick={() => runScaleStressTest('rls_overhead')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            🛡️ RLS Policy Overhead
          </button>
          <button 
            onClick={() => runScaleStressTest('concurrent_vibe')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            🔥 Concurrent Vibe Flood
          </button>
          <button 
            onClick={() => runScaleStressTest('cache_ttl')}
            style={{ ...hackBtnStyle, flex: '1 1 48%', minWidth: '120px', background: 'rgba(212,175,55,0.15)', cursor: 'pointer' }}
          >
            ❄️ Cold vs Warm Cache TTL
          </button>
        </div>

        {/* Network Drop simulator toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <input 
            type="checkbox" 
            id="kill-network" 
            checked={networkKilled}
            onChange={(e) => {
              const checked = e.target.checked
              setNetworkKilled(checked)
              if (typeof window !== 'undefined') {
                (window as unknown as { __networkKilled?: boolean }).__networkKilled = checked
              }
              setAlertNotification(checked ? 'Network killed! Vibe, RSVP, and Echo updates will now fail.' : 'Network restored.')
              setTimeout(() => setAlertNotification(null), 3000)
            }}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor="kill-network" style={{ color: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>
            {t('toggleNetworkDrop', lang)}
          </label>
        </div>

        {/* Stress Test Execution Log/Output */}
        {stressTestOutput && (
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            padding: '0.8rem',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#00ff00',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            maxHeight: '220px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            marginBottom: '1rem'
          }}>
            {stressTestOutput}
          </div>
        )}
      </div>

      {/* WAF Live Traffic Visualizer */}
      <div style={wafContainerStyle}>
        <p style={logTitleStyle}><Shield size={12} style={{ marginRight: 6 }} /> {t('visualWafFilter', lang)}</p>
        <div style={wafFlowContainerStyle}>
          {/* Flowing animated packet simulation */}
          <div style={wafVisualFlowStyle}>
            <motion.div 
              animate={{ 
                x: [0, 80, 160, 240, 310], 
                y: [0, 5, -5, 5, 0],
                backgroundColor: latestLog && latestLog.type !== 'auth_success' ? ['#22c55e', '#ef4444', '#ef4444'] : ['#22c55e', '#22c55e', '#3b82f6']
              }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              style={wafPacketStyle}
            />
            <div style={wafLineStyle} />
          </div>

          <div style={wafStatusGridStyle}>
            <div style={{ ...wafNodeStyle, borderColor: isLastRate ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
              <span style={{ ...wafNodeIndicatorStyle, background: isLastRate ? '#ef4444' : '#22c55e' }} />
              <span style={wafNodeLabelStyle}>Rate Limiter: {isLastRate ? 'LOCKOUT' : 'ACTIVE'}</span>
            </div>
            <div style={{ ...wafNodeStyle, borderColor: isLastSqli ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
              <span style={{ ...wafNodeIndicatorStyle, background: isLastSqli ? '#ef4444' : '#22c55e' }} />
              <span style={wafNodeLabelStyle}>SQLi Engine: {isLastSqli ? 'BLOCKED' : 'FILTERING'}</span>
            </div>
            <div style={{ ...wafNodeStyle, borderColor: isLastXss ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
              <span style={{ ...wafNodeIndicatorStyle, background: isLastXss ? '#ef4444' : '#22c55e' }} />
              <span style={wafNodeLabelStyle}>XSS Sandbox: {isLastXss ? 'STRIPPED' : 'SANITIZING'}</span>
            </div>
            <div style={{ ...wafNodeStyle, borderColor: isLastIdor ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
              <span style={{ ...wafNodeIndicatorStyle, background: isLastIdor ? '#ef4444' : '#22c55e' }} />
              <span style={wafNodeLabelStyle}>IDOR Guard: {isLastIdor ? 'DENIED' : 'SECURE'}</span>
            </div>
            <div style={{ ...wafNodeStyle, borderColor: isLastMalware ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
              <span style={{ ...wafNodeIndicatorStyle, background: isLastMalware ? '#ef4444' : '#22c55e' }} />
              <span style={wafNodeLabelStyle}>Malware: {isLastMalware ? 'BLOCKED' : 'SECURE'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* XSS Live Playground */}
      <div style={playgroundGroupStyle}>
        <p style={logTitleStyle}><FileCode size={12} style={{ marginRight: 6 }} /> Real-time XSS Sanitizer Preview:</p>
        <textarea 
          rows={2}
          placeholder="Type <script>alert('hack')</script> here to see real-time filter action..."
          value={sanitizationInput}
          onChange={(e) => handleSanitizationCheck(e.target.value)}
          style={consoleTextareaStyle}
        />
        <div style={sanitizationOutputBoxStyle}>
          <span style={sanLabelStyle}>Sanitized Value saved to DB:</span>
          <code style={sanValueStyle}>{sanitizationOutput || '(clean input will render here)'}</code>
        </div>
      </div>

      {/* File Upload vulnerability test */}
      <div style={{ ...playgroundGroupStyle, marginTop: '1rem' }}>
        <p style={logTitleStyle}><Upload size={12} style={{ marginRight: 6 }} /> Simulated File upload pentesting:</p>
        <div style={hackButtonsRowStyle}>
          <button 
            onClick={() => triggerMockUpload('exploit.php', 'document')}
            style={{ ...hackBtnStyle, cursor: 'pointer' }}
          >
            Test upload execution file (.php)
          </button>
          <button 
            onClick={() => triggerMockUpload('webshell.exe.jpg', 'listing')}
            style={{ ...hackBtnStyle, cursor: 'pointer' }}
          >
            Test upload spoofed extension (.exe.jpg)
          </button>
        </div>
      </div>

      <div style={{ ...styles.inputGroupStyle, marginTop: '1rem' }}>
        <label style={styles.labelStyleStyle}>Custom XSS URL query string simulation</label>
        <input 
          type="text" 
          placeholder="?search=<script>window.location=...</script>" 
          value={hackPayload}
          onChange={(e) => setHackPayload(e.target.value)}
          style={consoleInputStyle}
        />
      </div>

      {hackFeedback && (
        <div style={feedbackBoxStyleStyle(hackFeedbackType)}>
          <Info size={14} style={{ marginRight: 6 }} />
          <span>{hackFeedback}</span>
        </div>
      )}

      {/* Security Live Logs */}
      <div style={logConsoleStyle}>
        <p style={logTitleStyle}>{t('liveLogs', lang)}</p>
        <div style={logScrollAreaStyle}>
          {securityLogs.length > 0 ? (
            securityLogs.map(log => (
              <div key={log.id} style={logLineStyleStyle(log.type)}>
                <span style={logTimeStyle}>[{log.timestamp.substr(11, 8)}]</span>
                <span style={logTypeLabelStyle}>[{log.type.toUpperCase()}]</span>
                <span>{log.action} - {log.details}</span>
              </div>
            ))
          ) : (
            <div style={logEmptyStyle}>{t('noIncidents', lang)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
