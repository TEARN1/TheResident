'use client'

import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Terminal, Shield, AlertTriangle, Activity, Zap, ShieldCheck, Database, HardDrive, Wifi, Lock, Cpu, Globe, Server } from 'lucide-react'
import { RootState, AppDispatch, floodNotifications, markAllNotificationsRead, incrementApiCall, addLog } from '../../../store'
import WafConsoleTab from '../components/WafConsoleTab'
import {
  scanInput,
  sanitizeInput as secureSanitize
} from '../../../utils/security'

export default function AdminPage() {
  const dispatch = useDispatch() as AppDispatch
  const securityLogs = useSelector((state: RootState) => state.security.logs)
  const [hackPayload, setHackPayload] = useState('')
  const [hackFeedback, setHackFeedback] = useState<string | null>(null)
  const [hackFeedbackType, setHackFeedbackType] = useState<'success' | 'warning' | 'error'>('success')
  const [stressTestOutput, setStressTestOutput] = useState<string | null>(null)
  const [networkKilled, setNetworkKilled] = useState(false)
  const [sanitizationInput, setSanitizationInput] = useState('')
  const [sanitizationOutput, setSanitizationOutput] = useState('')

  const handleSanitizationCheck = (val: string) => {
    setSanitizationInput(val)
    const result = scanInput(val)
    const stripped = secureSanitize(val, 500)
    setSanitizationOutput(result.safe ? stripped : `[THREATS: ${result.threats.join(', ')}] ${stripped}`)
  }

  const runHackSimulation = (type: string) => {
    const ip = '127.0.0.1'
    dispatch(addLog({
        ip,
        action: `Simulation: ${type.toUpperCase()} attempt on dashboard endpoint`,
        type: (type === 'xss' ? 'xss_blocked' : type === 'sqli' ? 'sqli_blocked' : 'idor_prevented') as 'xss_blocked' | 'sqli_blocked' | 'idor_prevented',
        details: `WAF Rule #402 triggered. Malicious payload intercepted and dropped. IP logged.`,
    }))
    setHackFeedback(`[SIMULATION SUCCESS] ${type.toUpperCase()} intercepted by Edge Firewall. Logs updated.`)
    setHackFeedbackType('success')
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 shadow-lg shadow-red-500/5">
              <Terminal size={32} className="text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">Security <span className="text-red-500">Ops</span></h1>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] opacity-60">Ethical Pentesting Sandbox & Real-time WAF Monitoring</p>
            </div>
          </div>
        </div>

        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl w-full md:w-auto">
           <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Master Node: Online</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
            <div className="glass-panel p-1 bg-black/40 overflow-hidden border-red-500/10">
                <WafConsoleTab
                    securityLogs={securityLogs}
                    runHackSimulation={runHackSimulation}
                    networkKilled={networkKilled}
                    sanitizationInput={sanitizationInput}
                    handleSanitizationCheck={handleSanitizationCheck}
                    sanitizationOutput={sanitizationOutput}
                    hackPayload={hackPayload}
                    hackFeedback={hackFeedback}
                    hackFeedbackType={hackFeedbackType}
                    lang="en"
                    styles={{}}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="glass-panel p-6 bg-black/40 border-white/5 space-y-4 group">
                  <div className="flex justify-between items-center">
                     <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                        <Globe size={20} className="text-blue-400" />
                     </div>
                     <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Geo-fencing</span>
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight uppercase italic">CDN Edge Nodes</h3>
                  <div className="flex gap-1.5">
                     {[1,2,3,4,5,6].map(i => <div key={i} className="flex-1 h-1 bg-green-500/40 rounded-full" />)}
                     <div className="flex-1 h-1 bg-yellow-500/40 rounded-full" />
                  </div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">Distribution of incoming traffic across 7 global edge points. DDoS protection active.</p>
               </div>

               <div className="glass-panel p-6 bg-black/40 border-white/5 space-y-4 group">
                  <div className="flex justify-between items-center">
                     <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                        <Cpu size={20} className="text-purple-400" />
                     </div>
                     <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Compute</span>
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight uppercase italic">Runtime Stats</h3>
                  <div className="flex items-end gap-1 h-4">
                     {[20,40,30,80,50,60,40,90,30,40].map((h, i) => <div key={i} className="flex-1 bg-purple-500/20 rounded-t-sm" style={{height: `${h}%`}} />)}
                  </div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">Serverless function execution latency: <span className="text-white">42ms avg</span>. Memory footprint stable.</p>
               </div>
            </div>
        </div>

        <div className="space-y-8">
            <div className="glass-panel p-8 border-gold-primary/20 bg-gradient-to-br from-gold-primary/5 to-transparent space-y-6">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-gold-primary rounded-xl">
                      <Database size={24} className="text-black" />
                   </div>
                   <h3 className="text-lg font-black text-white tracking-tight uppercase italic">Registry <span className="text-gold-primary">Admin</span></h3>
                </div>

                <div className="space-y-4 pt-4">
                    <button className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-gold-primary/10">Purge Redis Cache</button>
                    <button className="w-full border border-gold-primary/20 text-gold-primary font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-gold-primary/5 transition-all">Sync RLS Policies</button>
                    <button
                       onClick={() => {
                          dispatch(floodNotifications(1000))
                          alert('1,000 Security Alerts Fired!')
                       }}
                       className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-red-500/20 transition-all"
                    >
                       Simulate Notification Flood
                    </button>
                </div>
            </div>

            <div className="glass-panel p-8 border-white/5 bg-black/40 space-y-6">
                <div className="flex items-center gap-3">
                   <Activity size={20} className="text-white" />
                   <h3 className="text-sm font-black text-white uppercase tracking-widest">System Health</h3>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-gray-500">Main Database</span>
                            <span className="text-green-500">Operational</span>
                        </div>
                        <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                           <div className="h-full bg-green-500 w-full" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-gray-500">Real-time Bus</span>
                            <span className="text-green-500">Operational</span>
                        </div>
                        <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                           <div className="h-full bg-green-500 w-full" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-gray-500">Asset Storage</span>
                            <span className="text-yellow-500">Degraded</span>
                        </div>
                        <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                           <div className="h-full bg-yellow-500 w-[65%]" />
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                   <div className="flex items-center gap-2 text-[10px] text-gray-600 font-black uppercase tracking-widest">
                      <Server size={12} /> Version: 4.2.0-secure-patch
                   </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}
