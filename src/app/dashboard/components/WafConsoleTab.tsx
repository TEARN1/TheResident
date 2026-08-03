'use client'

import React from 'react'
import { Terminal, Shield, AlertTriangle, Activity, Zap, ShieldCheck } from 'lucide-react'

interface SecurityLog {
  id: string
  timestamp: string
  action: string
  type: string
  details: string
  ip: string
}

type HackSimType = 'xss' | 'sqli' | 'idor' | 'nosqli' | 'traversal'

interface WafConsoleTabProps {
  securityLogs: SecurityLog[]
  runHackSimulation?: (type: HackSimType) => void
  runScaleStressTest?: (type: string) => void
  networkKilled: boolean
  setNetworkKilled?: (val: boolean) => void
  setAlertNotification?: (msg: string | null) => void
  stressTestOutput?: string | null
  sanitizationInput: string
  handleSanitizationCheck?: (val: string) => void
  sanitizationOutput: string
  triggerMockUpload?: (name: string, type: string) => void
  hackPayload: string
  setHackPayload?: (val: string) => void
  hackFeedback: string | null
  hackFeedbackType: 'success' | 'warning' | 'error'
  lang: string
  styles: Record<string, React.CSSProperties>
  // ... rest of the legacy prop styles (mapped to tailwind classes now)
}

export default function WafConsoleTab({
  securityLogs,
  runHackSimulation,
  hackFeedback,
  hackFeedbackType,
  sanitizationInput,
  handleSanitizationCheck,
  sanitizationOutput
}: WafConsoleTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-black border border-red-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-red-900/10">
         <div className="bg-red-500/5 p-4 border-b border-red-500/10 flex justify-between items-center">
            <div className="flex items-center gap-2 text-red-500 font-bold text-sm tracking-widest">
               <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
               SYSTEM FIREWALL & WAF CONSOLE
            </div>
            <Shield size={18} className="text-red-500/50" />
         </div>

         <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
               <div>
                  <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Payload Simulator</h4>
                  <div className="flex flex-col gap-2">
                     {([
                        { id: 'xss', label: 'Cross-Site Scripting (XSS)' },
                        { id: 'sqli', label: 'SQL Injection (SQLi)' },
                        { id: 'idor', label: 'Insecure Object Reference' },
                        { id: 'nosqli', label: 'NoSQL Operator Injection' },
                        { id: 'traversal', label: 'Path Traversal Attack' },
                     ] as Array<{ id: HackSimType; label: string }>).map(h => (
                        <button
                           key={h.id}
                           onClick={() => runHackSimulation?.(h.id)}
                           className="bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-gray-300 hover:text-red-500 p-3 rounded-xl text-left text-xs font-mono transition-all flex justify-between items-center group"
                        >
                           {h.label}
                           <Terminal size={14} className="opacity-20 group-hover:opacity-100" />
                        </button>
                     ))}
                  </div>
               </div>

               {hackFeedback && (
                  <div className={`p-4 rounded-xl border text-xs font-mono leading-relaxed ${
                     hackFeedbackType === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                     hackFeedbackType === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                     'bg-green-500/10 border-green-500/20 text-green-400'
                  }`}>
                     <div className="flex gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{hackFeedback}</span>
                     </div>
                  </div>
               )}
            </div>

            <div className="space-y-6">
               <div>
                  <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Sanitization Engine Preview</h4>
                  <div className="space-y-4">
                     <textarea
                        value={sanitizationInput}
                        onChange={(e) => handleSanitizationCheck?.(e.target.value)}
                        placeholder="Type raw input here to test cleaning..."
                        className="w-full h-24 bg-black border border-white/10 rounded-xl p-3 text-xs font-mono text-green-500 outline-none focus:border-green-500/30 transition-all"
                     />
                     <div className="bg-green-500/5 border border-green-500/10 p-3 rounded-xl space-y-2">
                        <p className="text-[8px] text-green-500/50 uppercase font-bold">WAF Output</p>
                        <p className="text-xs font-mono text-gray-300 break-all">{sanitizationOutput || 'Waiting for input...'}</p>
                     </div>
                  </div>
               </div>

               <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                  <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Real-time Logs</h4>
                  <div className="h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                     {securityLogs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[10px] text-gray-700 italic">No security events logged.</div>
                     ) : (
                        securityLogs.slice().reverse().map(log => (
                           <div key={log.id} className="text-[10px] font-mono border-b border-white/5 pb-2 last:border-0">
                              <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                              <span className="text-red-500 font-bold">{log.type.toUpperCase()}</span>:{' '}
                              <span className="text-gray-400">{log.action}</span>
                              <div className="text-gray-700 mt-0.5 pl-4 truncate">{log.details}</div>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
