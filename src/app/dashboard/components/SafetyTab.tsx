'use client'

import React, { useEffect, useState } from 'react'
import { Shield, Activity, Bell, MapPin, CheckCircle2, Info, Zap, Wifi, Check } from 'lucide-react'
import { outageConsensus, type StatusReport } from '../../../utils/logic'
import type { Alert, NeighbourhoodStatus } from '../../../store'

interface SafetyTabProps {
  alerts: Alert[]
  neighbourhoodStatus: NeighbourhoodStatus[]
  statusReports: StatusReport[]
  currentUserId: string
  isVerified: boolean
  suburb: string
  onRaiseAlert?: (args: { kind: 'panic' | 'incident' | 'suspicious'; title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical' }) => void
  onRespond?: (alertId: string, status: 'coming' | 'arrived' | 'stood_down') => void
  onResolve?: (alertId: string) => void
  onReportStatus?: (kind: 'power' | 'water' | 'network', status: 'up' | 'down') => void
  styles?: Record<string, React.CSSProperties>
}

const SERVICES: Array<{ key: 'power' | 'water' | 'network'; label: string; Icon: typeof Zap }> = [
  { key: 'power', label: 'Electricity', Icon: Zap },
  { key: 'water', label: 'Water', Icon: Info },
  { key: 'network', label: 'Network', Icon: Wifi }
]

export default function SafetyTab({
  alerts,
  neighbourhoodStatus,
  statusReports,
  currentUserId,
  isVerified,
  suburb,
  onRaiseAlert,
  onRespond,
  onResolve,
  onReportStatus
}: SafetyTabProps) {
  const [confirmPanic, setConfirmPanic] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [incidentTitle, setIncidentTitle] = useState('')
  const [incidentDesc, setIncidentDesc] = useState('')

  // The consensus window is time-based; recompute on a tick rather than
  // reading Date.now() during render (impure, and would never re-evaluate as
  // reports age out of the 30-minute window). Seed via useState's lazy
  // initializer so the effect only needs to set up the recurring tick.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const activeAlerts = alerts.filter(a => a.status === 'active')

  return (
    <div className="space-y-8">
      {/* Panic Section — deliberately two-step so a mis-tap can't page the neighbourhood */}
      <div className="glass-panel p-6 border-red-500/20 bg-red-500/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-full animate-pulse">
              <Shield size={32} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-500">Emergency & Panic</h3>
              <p className="text-gray-400 text-sm">Raise an immediate alert to verified neighbors and community watch.</p>
            </div>
          </div>

          {!confirmPanic ? (
            <button
              onClick={() => setConfirmPanic(true)}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-95"
            >
              RAISE PANIC ALERT
            </button>
          ) : (
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => {
                  onRaiseAlert?.({ kind: 'panic', title: 'Panic alert', description: 'Immediate help needed.', severity: 'critical' })
                  setConfirmPanic(false)
                }}
                className="flex-1 md:flex-none bg-red-600 text-white font-bold px-6 py-3 rounded-xl active:scale-95 transition-all"
              >
                Yes — send it now
              </button>
              <button
                onClick={() => setConfirmPanic(false)}
                className="flex-1 md:flex-none bg-white/5 text-gray-300 border border-white/10 px-6 py-3 rounded-xl"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowIncidentForm(v => !v)}
          className="mt-4 text-xs text-gray-500 hover:text-white uppercase tracking-widest font-bold"
        >
          {showIncidentForm ? 'Cancel' : 'Report a non-emergency incident'}
        </button>

        {showIncidentForm && (
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!incidentTitle.trim()) return
              onRaiseAlert?.({ kind: 'incident', title: incidentTitle, description: incidentDesc, severity: 'medium' })
              setIncidentTitle(''); setIncidentDesc(''); setShowIncidentForm(false)
            }}
            className="mt-4 space-y-3 bg-black/40 border border-white/5 rounded-xl p-4"
          >
            <input
              value={incidentTitle}
              onChange={e => setIncidentTitle(e.target.value)}
              placeholder="What happened?"
              required
              className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-red-500/40"
            />
            <textarea
              value={incidentDesc}
              onChange={e => setIncidentDesc(e.target.value)}
              placeholder="Any detail that would help a neighbour"
              className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white h-20 resize-none outline-none focus:border-red-500/40"
            />
            <button type="submit" className="bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-5 py-2 rounded-lg text-xs uppercase tracking-widest">
              Report it
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Alerts Feed */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-gold-primary" /> Active Safety Incidents
          </h3>

          {!isVerified && (
            <div className="text-xs text-gold-primary bg-gold-primary/10 border border-gold-primary/20 rounded-xl p-3">
              Only verified neighbours can respond to alerts. Get verified on The Gruvs to help out.
            </div>
          )}

          {activeAlerts.length === 0 ? (
            <div className="glass-panel p-12 text-center text-gray-500">
               <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500/50" />
               <p>No active incidents reported in {suburb || 'your area'}. Stay safe!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeAlerts.map(alert => (
                <div key={alert.id} className="glass-panel p-5 border-l-4 border-l-red-500">
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{alert.severity} SEVERITY</span>
                    <span className="text-[10px] text-gray-500">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="text-lg font-bold text-white">{alert.title}</h4>
                  <p className="text-sm text-gray-400 my-2">{alert.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                     <MapPin size={12} /> {alert.suburb || suburb}
                  </div>

                  <div className="flex gap-2">
                    {alert.createdBy === currentUserId ? (
                      <button
                        onClick={() => onResolve?.(alert.id)}
                        className="bg-gold-primary/10 text-gold-primary border border-gold-primary/20 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gold-primary hover:text-black transition-all"
                      >
                        <Check size={12} className="inline mr-1" /> Mark resolved
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onRespond?.(alert.id, 'coming')}
                          disabled={!isVerified}
                          className="bg-green-500/10 text-green-500 border border-green-500/20 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-500 hover:text-black transition-all"
                        >
                          I&apos;m coming
                        </button>
                        <button
                          onClick={() => onRespond?.(alert.id, 'arrived')}
                          disabled={!isVerified}
                          className="bg-white/5 text-gray-300 border border-white/10 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          I&apos;ve arrived
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Utility Status — crowd-signal consensus: one report is noise, three is a fact */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-gold-primary" /> Local Infrastructure
          </h3>
          <div className="glass-panel p-6 space-y-6">
             {SERVICES.map(({ key, label, Icon }) => {
               const consensus = outageConsensus(statusReports.filter(r => r.kind === key), now)
               const dbStatus = neighbourhoodStatus.find(s =>
                 s.service === (key === 'power' ? 'electricity' : key === 'water' ? 'water' : 'other')
               )
               const isDown = consensus.confirmed || dbStatus?.status === 'outage'

               return (
                 <div key={key} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-lg ${isDown ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                          <Icon size={18} className={isDown ? 'text-red-500' : 'text-green-500'} />
                       </div>
                       <span className="text-sm font-medium text-gray-300">{label}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isDown ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                          {isDown ? (consensus.confirmed ? `OUTAGE (${consensus.reporters} reports)` : 'OUTAGE') : 'OPERATIONAL'}
                       </span>
                       <div className="flex gap-1">
                          <button
                            onClick={() => onReportStatus?.(key, 'down')}
                            className="text-[9px] text-red-400 hover:text-red-300 uppercase font-bold"
                          >
                            Report down
                          </button>
                          <span className="text-gray-700">/</span>
                          <button
                            onClick={() => onReportStatus?.(key, 'up')}
                            className="text-[9px] text-green-400 hover:text-green-300 uppercase font-bold"
                          >
                            It&apos;s back
                          </button>
                       </div>
                    </div>
                 </div>
               )
             })}

             <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-gray-500 uppercase font-bold">
                  Three neighbours reporting the same outage within 30 minutes confirms it.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
