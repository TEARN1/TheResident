'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calculator, X, Plus, Trash2, Users, Copy, Check, MessageSquare, Send } from 'lucide-react'
import Link from 'next/link'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { SUPPORTED_CURRENCIES } from '../../../../utils/currencies'

interface ExpenseItem {
  id: string
  label: string
  amount: number
}

interface RoommateShare {
  name: string
  roomSizeRatio: number // 1 = standard equal share, 1.2 = master room, 0.8 = small room
}

export default function CoLivingExpenseSplitterModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [currency, setCurrency] = useState('ZAR')
  const [roommates, setRoommates] = useState<RoommateShare[]>([
    { name: 'You (Room 1)', roomSizeRatio: 1.0 },
    { name: 'Roommate 2', roomSizeRatio: 1.0 },
    { name: 'Roommate 3', roomSizeRatio: 1.0 }
  ])

  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: '1', label: 'Monthly Base Rent', amount: 12000 },
    { id: '2', label: 'Uncapped Fibre Wi-Fi', amount: 899 },
    { id: '3', label: 'Prepaid Electricity', amount: 1500 },
    { id: '4', label: 'Water & Sanitation', amount: 650 }
  ])

  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [copied, setCopied] = useState(false)
  const [paidRoommates, setPaidRoommates] = useState<number[]>([])
  const [pingedIdx, setPingedIdx] = useState<number | null>(null)
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null)

  const togglePaid = (idx: number) => {
    playTactileSound('click')
    setPaidRoommates(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])
  }

  const setRatio = (idx: number, ratio: number) => {
    playTactileSound('click')
    setRoommates(prev => prev.map((rm, i) => i === idx ? { ...rm, roomSizeRatio: ratio } : rm))
  }

  if (!isOpen) return null

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0)
  const totalRatios = roommates.reduce((acc, curr) => acc + curr.roomSizeRatio, 0)

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim() || !newAmount) return
    playTactileSound('pop')
    setExpenses(prev => [
      ...prev,
      { id: Date.now().toString(), label: newLabel.trim(), amount: parseFloat(newAmount) || 0 }
    ])
    setNewLabel('')
    setNewAmount('')
  }

  const handleDeleteExpense = (id: string) => {
    playTactileSound('click')
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const handleAddRoommate = () => {
    playTactileSound('pop')
    setRoommates(prev => [
      ...prev,
      { name: `Roommate ${prev.length + 1}`, roomSizeRatio: 1.0 }
    ])
  }

  const handleRemoveRoommate = (index: number) => {
    if (roommates.length <= 1) return
    playTactileSound('click')
    setRoommates(prev => prev.filter((_, i) => i !== index))
  }

  const handleCopyBreakdown = () => {
    playTactileSound('chime')
    const breakdownText = `
🏠 The Resident - Household Expense Split
------------------------------------------
Total Household Cost: ${currency} ${totalExpense.toLocaleString()}
Members (${roommates.length}):

${roommates
  .map(rm => {
    const share = Math.round((rm.roomSizeRatio / totalRatios) * totalExpense)
    return `• ${rm.name}: ${currency} ${share.toLocaleString()} (${Math.round((rm.roomSizeRatio / totalRatios) * 100)}%)`
  })
  .join('\n')}

Items:
${expenses.map(e => ` - ${e.label}: ${currency} ${e.amount.toLocaleString()}`).join('\n')}

Calculated via The Resident (TEARN Ecosystem | South Africa)
    `.trim()

    navigator.clipboard.writeText(breakdownText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-black/95 border border-gold-primary/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgb(var(--accent)/0.15)] backdrop-blur-2xl overflow-hidden max-h-[90vh] flex flex-col"
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
              <Calculator size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Co-Living Rent & Bill Splitter</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-gold-primary/15 text-gold-primary border border-gold-primary/30 px-2 py-0.5 rounded-full">
                  Fair Share Engine
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Split rent, fibre, prepaid power, and cleaning fairly with room weighting
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
            {/* Currency Selector Bar */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider shrink-0">Currency:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {SUPPORTED_CURRENCIES.map(c => {
                  const active = currency === c.code
                  return (
                    <button
                      key={c.code}
                      onClick={() => {
                        playTactileSound('click')
                        setCurrency(c.code)
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 ${
                        active
                          ? 'bg-gold-primary text-black font-black border border-gold-primary'
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span>{c.code}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Total Summary Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-gold-primary/10 via-amber-500/5 to-transparent border border-gold-primary/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gold-primary">Total Household Pool</span>
                <div className="text-2xl font-black text-white tracking-tight">
                  {currency} {totalExpense.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Residents</span>
                <div className="text-lg font-black text-white tracking-tight flex items-center justify-end gap-1">
                  <Users size={16} className="text-gold-primary" /> {roommates.length}
                </div>
              </div>
            </div>

            {/* Collection Progress Bar */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold">House Fund Collection:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {currency} {roommates.reduce((acc, rm, i) => paidRoommates.includes(i) ? acc + Math.round((rm.roomSizeRatio / totalRatios) * totalExpense) : acc, 0).toLocaleString()} / {currency} {totalExpense.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-primary to-emerald-400 transition-all duration-500 rounded-full"
                  style={{
                    width: `${totalExpense > 0 ? Math.min(100, Math.round((roommates.reduce((acc, rm, i) => paidRoommates.includes(i) ? acc + Math.round((rm.roomSizeRatio / totalRatios) * totalExpense) : acc, 0) / totalExpense) * 100)) : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Split Results Breakdown Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-300">Each Resident Pays</span>
                <button
                  onClick={handleAddRoommate}
                  className="text-[11px] text-gold-primary hover:underline font-bold flex items-center gap-1"
                >
                  <Plus size={12} /> Add Resident
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {roommates.map((rm, idx) => {
                  const share = Math.round((rm.roomSizeRatio / totalRatios) * totalExpense)
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1 relative group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-200 truncate">{rm.name}</span>
                        {roommates.length > 1 && (
                          <button
                            onClick={() => handleRemoveRoommate(idx)}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="text-base font-black text-gold-primary">
                        {currency} {share.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-gray-500 block">
                        {Math.round((rm.roomSizeRatio / totalRatios) * 100)}% of expenses · Ref: RES-{idx + 1}
                      </span>

                      {/* Room size ratio quick presets */}
                      <div className="flex items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => setRatio(idx, 1.2)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            rm.roomSizeRatio > 1.05
                              ? 'bg-gold-primary text-black border-gold-primary'
                              : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                          }`}
                        >
                          Master (+20%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRatio(idx, 1.0)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            Math.abs(rm.roomSizeRatio - 1.0) < 0.05
                              ? 'bg-gold-primary text-black border-gold-primary'
                              : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                          }`}
                        >
                          Equal
                        </button>
                        <button
                          type="button"
                          onClick={() => setRatio(idx, 0.85)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            rm.roomSizeRatio < 0.95
                              ? 'bg-gold-primary text-black border-gold-primary'
                              : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                          }`}
                        >
                          Compact (-15%)
                        </button>
                      </div>

                      {/* Payment tracking & In-App Resident ping */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paidRoommates.includes(idx)}
                            onChange={() => togglePaid(idx)}
                            className="accent-gold-primary w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className={`text-[10px] font-bold ${paidRoommates.includes(idx) ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {paidRoommates.includes(idx) ? 'Paid' : 'Unpaid'}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            playTactileSound('click');
                            const msg = `[BILL SPLIT] Hi ${rm.name}! Your co-living share for this month is ${currency} ${share.toLocaleString()} (Payment Ref: RES-${idx + 1}-HOUSE) [sticker:rent-settled]`;
                            navigator.clipboard.writeText(msg);
                            setPingedIdx(idx);
                            setBroadcastNotice(`Copied bill ping for ${rm.name}! Paste into Resident Messages.`);
                            setTimeout(() => setPingedIdx(null), 3000);
                          }}
                          className="text-[10px] font-bold text-gold-primary hover:text-white transition-colors flex items-center gap-1 min-h-[32px] px-1.5 rounded-md hover:bg-white/5"
                        >
                          <Send size={10} />
                          <span>{pingedIdx === idx ? 'Copied!' : 'Ping on Resident'}</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Expenses Breakdown List */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-300">Active Bills & Rent</span>
              <div className="space-y-1.5">
                {expenses.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs"
                  >
                    <span className="text-gray-300 font-medium">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold">{currency} {item.amount.toLocaleString()}</span>
                      <button
                        onClick={() => handleDeleteExpense(item.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Expense Form */}
              <form onSubmit={handleAddExpense} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="New item (e.g. Maid, Detergents)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-gold-primary text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gold-secondary transition-all active:scale-95"
                >
                  <Plus size={14} />
                </button>
              </form>
            </div>
          </div>

          {/* Modal Actions */}
          {broadcastNotice && (
            <div className="p-2.5 rounded-xl bg-gold-primary/10 border border-gold-primary/30 text-gold-primary text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
              <span>{broadcastNotice}</span>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyBreakdown}
                className="px-4 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 "
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied Breakdown!' : 'Copy for Chat'}</span>
              </button>
              <button
                onClick={() => {
                  playTactileSound('pop')
                  const subject = encodeURIComponent(`Monthly Household Expense Split (${currency} ${totalExpense.toLocaleString()})`)
                  const body = encodeURIComponent(
                    `Hi Housemates,\n\nHere is our monthly living expense split calculated via The Resident:\n\n` +
                    `Total Pool: ${currency} ${totalExpense.toLocaleString()}\n\n` +
                    `Individual Contributions:\n` +
                    roommates.map(rm => {
                      const share = Math.round((rm.roomSizeRatio / totalRatios) * totalExpense)
                      return `• ${rm.name}: ${currency} ${share.toLocaleString()}`
                    }).join('\n') +
                    `\n\nExpense Breakdown:\n` +
                    expenses.map(e => ` - ${e.label}: ${currency} ${e.amount.toLocaleString()}`).join('\n') +
                    `\n\nPlease transfer your shares before the rent due date.\n\nWarm regards,\nHousehold Lead`
                  )
                  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5"
                title="Send expense breakdown directly via email to all housemates"
              >
                <span>Email House</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTactileSound('click');
                  const text = `*MONTHLY CO-LIVING EXPENSE SPLIT*\nTotal: ${currency} ${totalExpense.toLocaleString()}\n\nContributions:\n` +
                    roommates.map(rm => {
                      const share = Math.round((rm.roomSizeRatio / totalRatios) * totalExpense);
                      return `• ${rm.name}: ${currency} ${share.toLocaleString()}`;
                    }).join('\n') +
                    `\n\n[sticker:rent-settled] Tracked on The Resident.`;
                  navigator.clipboard.writeText(text);
                  setBroadcastNotice('Copied full house split! Ready to paste in Resident Messages.');
                }}
                className="px-4 py-2.5 rounded-xl bg-gold-primary/10 hover:bg-gold-primary/20 border border-gold-primary/30 text-gold-primary font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 min-h-[44px]"
                title="Copy and dispatch expense split to flatmates via Resident Messages"
              >
                <MessageSquare size={13} />
                <span>Dispatch to House Chat</span>
              </button>
              <Link
                href="/dashboard/messages"
                onClick={() => { playTactileSound('pop'); onClose(); }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 min-h-[44px] no-underline"
              >
                <Send size={13} />
                <span>Open Messages</span>
              </Link>
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
