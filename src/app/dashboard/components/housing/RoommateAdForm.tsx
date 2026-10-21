'use client'

import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Users, Trash2 } from 'lucide-react'
import { AppDispatch, RoommateSeeker, User, addRoommateSeeker, removeRoommateSeeker } from '../../../../store'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface Props {
  currentUser: User
  /** The viewer's ad, if they already posted one. */
  myAd?: RoommateSeeker
  onDone: (message: string) => void
}

/**
 * Post (or update, or take down) your own "looking for a place to share" ad.
 * The Roommates tab could list ads but there was no way to post one, so it
 * was always empty. One ad per person: the row id is your user id.
 */
export default function RoommateAdForm({ currentUser, myAd, onDone }: Props) {
  const dispatch = useDispatch<AppDispatch>()
  const [open, setOpen] = useState(false)
  const [budget, setBudget] = useState(myAd ? String(myAd.budget) : '')
  const [suburb, setSuburb] = useState(myAd?.suburb ?? '')
  const [gender, setGender] = useState<'men' | 'women'>(myAd?.gender ?? 'women')
  const [childrenCount, setChildrenCount] = useState(myAd ? String(myAd.childrenCount) : '0')
  const [bio, setBio] = useState(myAd?.bio ?? '')

  const amount = Number(budget)
  const canSave = amount > 0 && suburb.trim().length > 1 && bio.trim().length > 9

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    playTactileSound('chime')
    dispatch(addRoommateSeeker({
      id: currentUser.id,
      name: currentUser.name,
      gender,
      childrenCount: Math.max(0, Math.floor(Number(childrenCount) || 0)),
      budget: amount,
      currency: 'ZAR',
      location: suburb.trim(),
      suburb: suburb.trim(),
      bio: bio.trim()
    }))
    setOpen(false)
    onDone(myAd ? 'Your roommate ad is updated.' : 'Your roommate ad is up. People can message you from it.')
  }

  const remove = () => {
    playTactileSound('pop')
    dispatch(removeRoommateSeeker(currentUser.id))
    setOpen(false)
    onDone('Your roommate ad is removed.')
  }

  if (!open) {
    return (
      <div className="glass-panel p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2 rounded-xl bg-gold-primary/10 text-gold-primary shrink-0"><Users size={18} /></span>
          <p className="m-0 text-sm text-gray-300">
            {myAd ? 'Your roommate ad is live.' : 'Looking for someone to share with? Post a short ad.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { playTactileSound('tab'); setOpen(true) }}
          className="px-4 py-2 rounded-xl bg-gold-primary text-black text-xs font-black uppercase tracking-wider"
        >
          {myAd ? 'Edit my ad' : 'Post an ad'}
        </button>
      </div>
    )
  }

  const field = 'w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-gold-primary/50'

  return (
    <form onSubmit={save} className="glass-panel p-4 sm:p-5 space-y-3">
      <h3 className="m-0 text-sm font-black text-white">{myAd ? 'Edit your roommate ad' : 'Post a roommate ad'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-gray-400">Budget a month (R)</span>
          <input className={field} inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value.replace(/[^\d]/g, ''))} placeholder="4000" />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-gray-400">Suburb</span>
          <input className={field} value={suburb} onChange={e => setSuburb(e.target.value)} placeholder="e.g. Braamfontein" maxLength={60} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-gray-400">I am a</span>
          <select className={field} value={gender} onChange={e => setGender(e.target.value as 'men' | 'women')}>
            <option value="women">Woman</option>
            <option value="men">Man</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-gray-400">Children with me</span>
          <input className={field} inputMode="numeric" value={childrenCount} onChange={e => setChildrenCount(e.target.value.replace(/[^\d]/g, '').slice(0, 2))} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-gray-400">About you</span>
        <textarea
          className={`${field} min-h-[80px] resize-y`}
          value={bio}
          onChange={e => setBio(e.target.value)}
          maxLength={300}
          placeholder="Work or study, quiet or social, what you are looking for."
        />
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="submit"
          disabled={!canSave}
          className="px-4 py-2 rounded-xl bg-gold-primary text-black text-xs font-black uppercase tracking-wider disabled:opacity-40"
        >
          {myAd ? 'Save' : 'Post'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-bold">
          Cancel
        </button>
        {myAd && (
          <button type="button" onClick={remove} className="ml-auto px-3 py-2 rounded-xl text-red-300 text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/10">
            <Trash2 size={13} /> Remove my ad
          </button>
        )}
      </div>
    </form>
  )
}
