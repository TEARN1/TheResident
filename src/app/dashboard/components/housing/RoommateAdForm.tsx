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

const BUDGET_PRESETS = [2500, 3500, 4500, 6000]
const LIFESTYLE_TAGS = [
  'Non-Smoker', 'Student', 'Young Pro', 'Early Bird', 'Night Owl', 'Quiet', 'Social',
  'Vegetarian', 'Halaal Friendly', 'Wits', 'UJ', 'Remote Worker', 'Clean Freak'
]
const MOVE_IN_OPTIONS = ['Immediately', '1st of next month', 'Flexible']

export default function RoommateAdForm({ currentUser, myAd, onDone }: Props) {
  const dispatch = useDispatch<AppDispatch>()
  const [open, setOpen] = useState(false)
  const [budget, setBudget] = useState(myAd ? String(myAd.budget) : '')
  const [suburb, setSuburb] = useState(myAd?.suburb ?? '')
  const [gender, setGender] = useState<'men' | 'women'>(myAd?.gender ?? 'women')
  const [childrenCount, setChildrenCount] = useState(myAd ? String(myAd.childrenCount) : '0')
  const [bio, setBio] = useState(myAd?.bio ?? '')
  const [moveIn, setMoveIn] = useState('Flexible')

  const amount = Number(budget)
  const canSave = amount > 0 && suburb.trim().length > 1 && bio.trim().length > 9

  const toggleTag = (tag: string) => {
    playTactileSound('click')
    if (bio.includes(tag)) {
      setBio(bio.replace(new RegExp(`\\s*#${tag}`, 'g'), '').trim())
    } else {
      const addition = bio.length > 0 ? ` #${tag}` : `#${tag}`
      if (bio.length + addition.length <= 300) {
        setBio(bio + addition)
      }
    }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    playTactileSound('chime')
    const finalBio = moveIn !== 'Flexible' ? `[Move-in: ${moveIn}] ${bio}` : bio
    dispatch(addRoommateSeeker({
      id: currentUser.id,
      name: currentUser.name,
      gender,
      childrenCount: Math.max(0, Math.floor(Number(childrenCount) || 0)),
      budget: amount,
      currency: 'ZAR',
      location: suburb.trim(),
      suburb: suburb.trim(),
      bio: finalBio.trim()
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
          className="px-4 py-2.5 rounded-xl bg-gold-primary text-black text-xs font-black uppercase tracking-wider touch-target-44 transition-transform active:scale-97"
        >
          {myAd ? 'Edit my ad' : 'Post an ad'}
        </button>
      </div>
    )
  }

  const field = 'w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-gold-primary/50 min-h-[44px]'

  return (
    <form onSubmit={save} className="glass-panel p-4 sm:p-5 space-y-4">
      <h3 className="m-0 text-sm font-black text-white">{myAd ? 'Edit your roommate ad' : 'Post a roommate ad'}</h3>

      {/* Preset budget quick pills */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-gray-400">Quick Budget</span>
        <div className="flex flex-wrap gap-2">
          {BUDGET_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => { setBudget(String(preset)); playTactileSound('click') }}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                budget === String(preset)
                  ? 'bg-gold-primary text-black border-gold-primary'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20'
              }`}
            >
              R{preset.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Move-in timeline pills */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-gray-400">Move-In Timeline</span>
        <div className="flex flex-wrap gap-2">
          {MOVE_IN_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { setMoveIn(opt); playTactileSound('click') }}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                moveIn === opt
                  ? 'bg-gold-primary text-black border-gold-primary'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-gray-400">Monthly Budget (ZAR)</span>
          <input className={field} inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value.replace(/[^\d]/g, ''))} placeholder="4000" />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-gray-400">Target Suburb</span>
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

      {/* Selectable lifestyle chips */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-gray-400">Lifestyle Chips (tap to add to bio)</span>
        <div className="flex flex-wrap gap-1.5">
          {LIFESTYLE_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                bio.includes(tag)
                  ? 'bg-gold-primary/20 text-gold-primary border-gold-primary/40'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-1">
        <div className="flex justify-between items-center text-[11px] font-bold text-gray-400">
          <span>About you</span>
          <span className={bio.length > 280 ? 'text-amber-400' : 'text-gray-500'}>{bio.length}/300</span>
        </div>
        <textarea
          className={`${field} min-h-[90px] resize-y`}
          value={bio}
          onChange={e => setBio(e.target.value)}
          maxLength={300}
          placeholder="Work or study, lifestyle, cleanliness, quiet or social, what you are looking for in a co-living home."
        />
      </label>

      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          type="submit"
          disabled={!canSave}
          className="px-5 py-2.5 rounded-xl bg-gold-primary text-black text-xs font-black uppercase tracking-wider disabled:opacity-40 touch-target-44 transition-transform active:scale-97"
        >
          {myAd ? 'Save Changes' : 'Post Ad'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-bold touch-target-44 hover:bg-white/10"
        >
          Cancel
        </button>
        {myAd && (
          <button
            type="button"
            onClick={remove}
            className="ml-auto px-3 py-2.5 rounded-xl text-red-300 text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/10 touch-target-44"
          >
            <Trash2 size={14} /> Remove my ad
          </button>
        )}
      </div>
    </form>
  )
}
