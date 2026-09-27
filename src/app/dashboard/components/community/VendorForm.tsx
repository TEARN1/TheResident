'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { Vendor } from '../../../../store'

export interface VendorFormValues {
  name: string
  category: string
  description: string
  contactNumber: string
  suburb: string
  city: string
  hours: string
  showPublicly: boolean
}

// Matches the kinds res_vendors accepts; anything else is stored as 'other'.
const KINDS = [
  { value: 'spaza', label: 'Spaza shop' },
  { value: 'food', label: 'Food / takeaways' },
  { value: 'produce', label: 'Fruit & veg' },
  { value: 'airtime', label: 'Airtime & data' },
  { value: 'gas', label: 'Gas' },
  { value: 'other', label: 'Other' },
]

const inputClass = 'w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40'

interface Props {
  // The vendor being edited, or null to register a new one.
  vendor: Vendor | null
  defaultSuburb?: string
  onSave: (values: VendorFormValues) => void
  onClose: () => void
}

export default function VendorForm({ vendor, defaultSuburb, onSave, onClose }: Props) {
  const [v, setV] = useState<VendorFormValues>({
    name: vendor?.name ?? '',
    category: vendor?.category?.toLowerCase() || 'spaza',
    description: vendor?.description ?? '',
    contactNumber: vendor?.contactNumber ?? '',
    suburb: vendor?.suburb ?? defaultSuburb ?? '',
    city: vendor?.city ?? '',
    hours: vendor?.hours ?? '',
    showPublicly: vendor?.showPublicly === true,
  })
  const set = <K extends keyof VendorFormValues>(key: K, value: VendorFormValues[K]) =>
    setV(prev => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ ...v, name: v.name.trim(), description: v.description.trim(), suburb: v.suburb.trim(), city: v.city.trim(), hours: v.hours.trim() })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-lg bg-black border-gold-primary/20 shadow-2xl relative z-10 overflow-hidden">
        <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
            {vendor ? <>Edit <span className="text-gold-primary">Shop</span></> : <>Register your <span className="text-gold-primary">Shop</span></>}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors"><X /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <input value={v.name} onChange={e => set('name', e.target.value)} required maxLength={80} placeholder="Shop name, e.g. Mama Thandi's Spaza" className={inputClass} />
          <select value={v.category} onChange={e => set('category', e.target.value)} className={inputClass}>
            {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <textarea
            value={v.description}
            onChange={e => set('description', e.target.value)}
            required
            minLength={30}
            maxLength={1000}
            placeholder="What do you sell? What makes your shop worth visiting? (at least a couple of sentences)"
            className={`${inputClass} h-28 resize-none`}
          />
          <div className="flex gap-3">
            <input value={v.suburb} onChange={e => set('suburb', e.target.value)} required placeholder="Suburb" className={inputClass} />
            <input value={v.city} onChange={e => set('city', e.target.value)} placeholder="City / town" className={inputClass} />
          </div>
          <div className="flex gap-3">
            <input value={v.hours} onChange={e => set('hours', e.target.value)} placeholder="Hours, e.g. Mon–Sat 7am–8pm" className={inputClass} />
            <input value={v.contactNumber} onChange={e => set('contactNumber', e.target.value)} placeholder="Phone (members only)" className={inputClass} />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={v.showPublicly} onChange={e => set('showPublicly', e.target.checked)} className="mt-1 accent-[var(--gold-primary)]" />
            <span className="text-xs text-gray-400 leading-relaxed">
              <span className="text-white font-bold">Show my shop on Google.</span> Your shop name, type, description, hours and suburb appear on a public page anyone can find. Your phone number and exact location stay private.
            </span>
          </label>
          <button type="submit" className="w-full bg-gold-primary text-black font-black py-2.5 rounded-lg text-xs uppercase tracking-widest">
            {vendor ? 'Save changes' : 'Register shop'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
