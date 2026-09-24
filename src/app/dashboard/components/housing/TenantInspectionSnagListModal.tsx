'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, X, CheckSquare, Square, Camera, AlertTriangle, ShieldCheck, Download, Plus, Trash2 } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface SnagItem {
  id: string
  room: string
  description: string
  severity: 'minor' | 'moderate' | 'urgent'
  confirmed: boolean
}

/** The three severities the form offers; kept as one named type so the
 *  select's cast is checked against the state's own type. */
type SnagSeverity = 'minor' | 'moderate' | 'urgent'

export default function TenantInspectionSnagListModal({
  isOpen,
  onClose,
  propertyAddress = 'Residence Property'
}: {
  isOpen: boolean
  onClose: () => void
  propertyAddress?: string
}) {
  const [items, setItems] = useState<SnagItem[]>([
    { id: '1', room: 'Bedroom', description: 'Window latch loose on northern frame', severity: 'minor', confirmed: false },
    { id: '2', room: 'Bathroom', description: 'Slow water drainage in shower basin', severity: 'moderate', confirmed: false },
    { id: '3', room: 'Kitchen', description: 'Stove plate #2 ignition requires check', severity: 'moderate', confirmed: false },
    { id: '4', room: 'Entrance', description: 'Main door lock cylinder stiff to turn', severity: 'urgent', confirmed: false }
  ])

  const [newRoom, setNewRoom] = useState('Bedroom')
  const [newDesc, setNewDesc] = useState('')
  const [newSeverity, setNewSeverity] = useState<SnagSeverity>('minor')

  if (!isOpen) return null

  const toggleConfirm = (id: string) => {
    playTactileSound('pop')
    setItems(prev => prev.map(item => item.id === id ? { ...item, confirmed: !item.confirmed } : item))
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDesc.trim()) return
    playTactileSound('success')
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(), room: newRoom, description: newDesc.trim(), severity: newSeverity, confirmed: false }
    ])
    setNewDesc('')
  }

  const handleDeleteItem = (id: string) => {
    playTactileSound('click')
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const handleExport = () => {
    playTactileSound('chime')
    const reportText = `
================================================================================
OFFICIAL MOVE-IN PROPERTY CONDITION & DEFECT REPORT
Property: ${propertyAddress}
Date: ${new Date().toLocaleDateString()}
Status: Verified by Resident
Jurisdiction / Standard: International Co-Living Deposit Protection Standard
================================================================================

RECORDED DEFECTS & INSPECTION ITEMS (${items.length}):
${items.map((item, idx) => `${idx + 1}. [${item.room.toUpperCase()}] (${item.severity.toUpperCase()}): ${item.description} - Verified: ${item.confirmed ? 'YES' : 'PENDING'}`).join('\n')}

================================================================================
TENANT SIGNATURE: ______________________    DATE: ______________________
LANDLORD SIGNATURE: ____________________    DATE: ______________________
Generated via The Resident Global Civic Platform (TEARN Ecosystem)
================================================================================
    `.trim()

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `MoveIn_SnagList_${propertyAddress.replace(/\s+/g, '_')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-black/95 border border-gold-primary/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(212,175,55,0.15)] backdrop-blur-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gold-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={() => { playTactileSound('pop'); onClose() }}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gold-primary to-amber-500 flex items-center justify-center text-black shadow-lg">
              <ClipboardList size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Move-In Inspection &amp; Snag List</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-gold-primary/15 text-gold-primary border border-gold-primary/30 px-2 py-0.5 rounded-full">
                  Deposit Protection
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Log pre-existing defects on move-in day to guarantee full statutory deposit refunds worldwide
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {/* Items list */}
            <div className="space-y-2">
              {items.map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3 group hover:border-gold-primary/30 transition-all"
                >
                  <button
                    onClick={() => toggleConfirm(item.id)}
                    className="text-gray-400 hover:text-gold-primary transition-colors shrink-0"
                  >
                    {item.confirmed ? <CheckSquare size={18} className="text-emerald-400" /> : <Square size={18} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-gold-primary">{item.room}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.2 rounded-full border ${
                        item.severity === 'urgent'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : item.severity === 'moderate'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-white/5 text-gray-400 border-white/10'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 leading-snug ${item.confirmed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                      {item.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1 transition-opacity shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add defect form */}
            <form onSubmit={handleAddItem} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">Record New Defect</span>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newRoom}
                  onChange={e => setNewRoom(e.target.value)}
                  className="bg-black border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-gold-primary/50"
                >
                  <option value="Bedroom">Bedroom</option>
                  <option value="Bathroom">Bathroom</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Living Room">Living Room</option>
                  <option value="Entrance & Keys">Entrance &amp; Keys</option>
                </select>

                <select
                  value={newSeverity}
                  onChange={e => setNewSeverity(e.target.value as SnagSeverity)}
                  className="bg-black border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-gold-primary/50"
                >
                  <option value="minor">Minor cosmetic</option>
                  <option value="moderate">Moderate fix</option>
                  <option value="urgent">Urgent hazard</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Describe damage (e.g. Scratched parquet, cracked tile)"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-gold-primary/50"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95"
                >
                  Add
                </button>
              </div>
            </form>
          </div>

          {/* Footer actions */}
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-gold-primary/10"
              >
                <Download size={14} />
                <span>Export (.txt)</span>
              </button>
              <button
                onClick={() => {
                  playTactileSound('pop')
                  const subject = encodeURIComponent(`Move-In Inspection Snag List - ${propertyAddress}`)
                  const body = encodeURIComponent(
                    `Hi Landlord,\n\nPlease find the recorded defects for the move-in inspection at ${propertyAddress}:\n\n` +
                    items.map((it, i) => `${i + 1}. [${it.room}] ${it.description} (${it.severity})`).join('\n') +
                    `\n\nPlease acknowledge receipt so maintenance repairs can be scheduled.\n\nWarm regards,\nTenant`
                  )
                  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5"
                title="Email inspection snag report directly to property owner or landlord"
              >
                <span>Email Landlord</span>
              </button>
            </div>
            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
