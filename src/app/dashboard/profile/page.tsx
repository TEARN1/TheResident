'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import Link from 'next/link'
import { User as UserIcon, Briefcase, Save, Loader, ShieldCheck, LogIn, LogOut, Globe, Camera, Check, Sun, Moon } from 'lucide-react'
import { RootState, AppDispatch, updateProfile, updatePreferences, updateUserRole, setLegalName, setLanguage, logoutUser, isGuestUser, addLog, addNotification } from '../../../store'
import { getErrorMessage } from '../../../utils/errors'
import { supabase } from '../../../utils/supabase'
import UpgradeButton from '../components/shared/UpgradeButton'
import TrustBadge from '../components/trust-safety/TrustBadge'
import { goldButtonClass } from '../../../components/ui/GoldButton'
import Card from '../../../components/ui/Card'

const LANGUAGES: { code: 'en' | 'zu' | 'xh' | 'af'; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa' },
  { code: 'af', label: 'Afrikaans' }
]

// The `updateProfile` / `updatePreferences` actions — and their full
// res_profiles sync path in store/index.ts's middleware — already existed
// before this page did. Nothing in the app ever dispatched them: the auth
// page collects this data once at signup and there was no way to see or
// change it again afterward. This is that missing screen.
export default function ProfilePage() {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const lang = useSelector((state: RootState) => state.ui.language)
  const services = useSelector((state: RootState) => state.networking.services)
  const guest = isGuestUser(currentUser)
  const myServiceOwned = !!currentUser && services.some(s => s.ownerId === currentUser.id)

  // Everything that used to live in the top bar's hamburger/"More" panel now
  // lives here — Profile is reached from the bottom bar, so account-level
  // actions (log out, upgrade, verification) belong next to the profile
  // itself rather than behind a separate menu that had nothing else in it.
  const handleLogout = () => {
    document.cookie = 'guest-mode=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    dispatch(logoutUser())
    router.push('/auth')
  }

  // Shared app-wide theme — 'residentTheme' in localStorage, the same key
  // the root layout's pre-hydration script and the auth page now read/write
  // too, so a choice made anywhere in the app applies everywhere. Persisted
  // directly here since this page doesn't own the <html data-theme>
  // attribute the layout does.
  const [dashboardTheme, setDashboardThemeState] = useState<'night' | 'light'>('night')
  useEffect(() => {
    const stored = localStorage.getItem('residentTheme')
    setDashboardThemeState(stored === 'light' ? 'light' : 'night')
  }, [])
  const setDashboardTheme = (theme: 'night' | 'light') => {
    localStorage.setItem('residentTheme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    setDashboardThemeState(theme)
  }

  const [hasPlus, setHasPlus] = useState<boolean | null>(null)
  useEffect(() => {
    if (guest) return
    let cancelled = false
    import('../../../utils/subscriptions').then(({ hasHouseholdPlus }) =>
      hasHouseholdPlus().then(has => { if (!cancelled) setHasPlus(has) })
    )
    return () => { cancelled = true }
  }, [guest])

  // A "picture of yourself" — reuses res_profiles.verification_doc_url,
  // which already existed for exactly this (see UserProfile.verificationDocUrl)
  // and already had a paid "speed up" flow (UpgradeButton item="verification_speedup"
  // below) but no way to actually attach the photo it verifies. Fetched
  // directly rather than through the typed tenant/landlord profile objects,
  // since this column applies to both roles and neither client type carries it.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!currentUser || guest || !supabase) return
    let cancelled = false
    supabase.from('res_profiles').select('verification_doc_url').eq('id', currentUser.id).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setPhotoUrl(data.verification_doc_url || null) })
    return () => { cancelled = true }
  }, [currentUser, guest])

  const handlePhotoUpload = async (file: File) => {
    if (!supabase || !currentUser) return
    if (!file.type.startsWith('image/')) { setPhotoError('Please choose an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Keep it under 5MB.'); return }
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      // Path convention per CONTRACT.md §4: uploads must start with
      // `${user.id}/` — RLS on the bucket enforces it.
      const path = `${currentUser.id}/res/verification_${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('gossip-media').upload(path, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('gossip-media').getPublicUrl(path)
      const { error: updateError } = await supabase.from('res_profiles').update({ verification_doc_url: urlData.publicUrl }).eq('id', currentUser.id)
      if (updateError) throw updateError
      setPhotoUrl(urlData.publicUrl)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed — try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const [legalName, setLegalNameInput] = useState('')
  const [legalNameSaved, setLegalNameSaved] = useState(false)
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<'men' | 'women' | 'any'>('any')
  const [childrenCount, setChildrenCount] = useState(0)
  const [employmentStatus, setEmploymentStatus] = useState('Employed')
  const [hasPets, setHasPets] = useState(false)

  const [genderPreference, setGenderPreference] = useState<'men' | 'women' | 'couple' | 'any'>('any')
  const [childrenAllowed, setChildrenAllowed] = useState(true)
  const [maxChildren, setMaxChildren] = useState(2)
  const [smokingAllowed, setSmokingAllowed] = useState(false)
  const [petsAllowed, setPetsAllowed] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [roleSwitching, setRoleSwitching] = useState(false)

  const handleSwitchRole = async (newRole: 'tenant' | 'landlord') => {
    if (!currentUser || guest || currentUser.role === newRole) return
    const previousRole = currentUser.role
    setRoleSwitching(true)
    try {
      if (supabase) {
        await supabase.from('res_profiles').update({ role: newRole }).eq('id', currentUser.id)
      }
      dispatch(updateUserRole(newRole))
      // A role switch changes what someone else's requirement filters and
      // landlord preferences mean for this account — auditable the same way
      // any other account-state change is (addLog), and visible to the
      // account owner (addNotification) in case it wasn't them.
      dispatch(addLog({
        action: `Account role switched: ${previousRole} → ${newRole}`,
        type: 'role_switched',
        details: `User ${currentUser.id} switched from ${previousRole} to ${newRole}.`
      }))
      dispatch(addNotification({
        title: 'Role switched',
        message: `Your account is now set up as a ${newRole}. If this wasn't you, review your account security.`,
        read: false
      }))
    } catch (err) {
      console.error('Failed to switch role', getErrorMessage(err))
    } finally {
      setRoleSwitching(false)
    }
  }

  // Seeds the editable form fields once the server's copy of the profile
  // arrives (it loads asynchronously after auth resolves) — a one-time sync
  // from external state into local form state, not a render-loop risk.
  useEffect(() => {
    if (!currentUser) return
    setLegalNameInput(currentUser.legalName || '')
    if (currentUser.role === 'tenant' && currentUser.profile) {
      const p = currentUser.profile
      setBio(p.bio || '')
      setGender(p.gender || 'any')
      setChildrenCount(p.childrenCount || 0)
      setEmploymentStatus(p.employmentStatus || 'Employed')
      setHasPets(!!p.hasPets)
    }
    if (currentUser.role === 'landlord' && currentUser.preferences) {
      const p = currentUser.preferences
      setGenderPreference(p.genderPreference || 'any')
      setChildrenAllowed(p.childrenAllowed ?? true)
      setMaxChildren(p.maxChildren ?? 2)
      setSmokingAllowed(!!p.smokingAllowed)
      setPetsAllowed(!!p.petsAllowed)
    }
  }, [currentUser])

  if (!currentUser) return null

  // Language is a device/session preference, not something tied to having
  // an account — a guest deciding the app should read in isiZulu shouldn't
  // need to sign up first. Shown on Profile rather than buried in the
  // hamburger settings panel, since it's part of who you are on the
  // platform, not app chrome.
  const languageCard = (
    <div className="glass-panel p-6 space-y-3">
      <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
        <Globe size={16} /> Language
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => dispatch(setLanguage(l.code))}
            aria-pressed={lang === l.code}
            className={`p-3 rounded-xl border text-xs font-bold transition-all ${lang === l.code ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black border-white/10 text-gray-300 hover:border-gold-primary/40'}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )

  const themeCard = (
    <div className="glass-panel p-6 space-y-3">
      <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
        {dashboardTheme === 'night' ? <Moon size={16} /> : <Sun size={16} />} Appearance
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setDashboardTheme('night')}
          aria-pressed={dashboardTheme === 'night'}
          className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${dashboardTheme === 'night' ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black border-white/10 text-gray-300 hover:border-gold-primary/40'}`}
        >
          <Moon size={14} /> Dark
        </button>
        <button
          onClick={() => setDashboardTheme('light')}
          aria-pressed={dashboardTheme === 'light'}
          className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${dashboardTheme === 'light' ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black border-white/10 text-gray-300 hover:border-gold-primary/40'}`}
        >
          <Sun size={14} /> Light
        </button>
      </div>
    </div>
  )

  if (guest) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
        <div className="glass-panel p-10 text-center space-y-4">
          <UserIcon size={40} className="mx-auto text-gold-primary opacity-60" />
          <h2 className="text-xl font-bold text-white">No profile to show yet</h2>
          <p className="text-sm text-gray-400">Guests browse without an account, so there&apos;s nothing here to edit. Sign up to build a profile landlords and neighbours can actually see.</p>
          <Link href="/auth" className="inline-flex items-center gap-2 bg-gold-primary text-black font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest">
            <LogIn size={14} /> Create an account
          </Link>
        </div>
        {themeCard}
        {languageCard}
      </div>
    )
  }

  const onSaveTenant = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    dispatch(updateProfile({ profile: { bio, gender, childrenCount, employmentStatus, hasPets } }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const onSaveLandlord = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    dispatch(updatePreferences({ preferences: { genderPreference, childrenAllowed, maxChildren, smokingAllowed, petsAllowed } }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
      <div className="glass-panel p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gold-primary text-black flex items-center justify-center text-2xl font-black shrink-0">
          {currentUser.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white truncate">{currentUser.name}</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">{currentUser.role}</p>
          <div className="mt-1"><TrustBadge userId={currentUser.id} /></div>
        </div>
      </div>

      {/* Account Mode / Role Switcher */}
      <Card className="space-y-3">
        <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
          <UserIcon size={16} /> Account Mode / Role
        </h2>
        <p className="text-[11px] text-gray-500">
          Switching to <strong>Landlord</strong> enables adding properties, listing empty rooms, and managing tenant applications. Switch to <strong>Tenant</strong> to set your room requirements.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSwitchRole('tenant')}
            disabled={roleSwitching || currentUser.role === 'tenant'}
            className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              currentUser.role === 'tenant'
                ? 'bg-gold-primary text-black border-gold-primary font-black shadow-lg shadow-gold-primary/20'
                : 'bg-black border-white/10 text-gray-300 hover:border-gold-primary/40'
            }`}
          >
            <span>Tenant Mode</span>
            <span className="text-[9px] opacity-70 font-normal">Look for rooms & roommates</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchRole('landlord')}
            disabled={roleSwitching || currentUser.role === 'landlord'}
            className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              currentUser.role === 'landlord'
                ? 'bg-gold-primary text-black border-gold-primary font-black shadow-lg shadow-gold-primary/20'
                : 'bg-black border-white/10 text-gray-300 hover:border-gold-primary/40'
            }`}
          >
            <span>Landlord Mode</span>
            <span className="text-[9px] opacity-70 font-normal">List empty rooms & manage units</span>
          </button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
          <Camera size={16} /> Your Photo
        </h2>
        <p className="text-[11px] text-gray-500">A real photo of yourself helps neighbours and landlords trust who they&apos;re dealing with. It&apos;s kept with your verification info.</p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Your uploaded photo" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={24} className="text-gray-600" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className={goldButtonClass()}
            >
              {photoUploading ? <Loader size={14} className="animate-spin" /> : photoUrl ? <Check size={14} /> : <Camera size={14} />}
              {photoUploading ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload a photo'}
            </button>
            {photoError && <p className="text-[11px] text-red-400">{photoError}</p>}
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
          <UserIcon size={16} /> Legal Name
        </h2>
        <p className="text-[11px] text-gray-500">
          Separate from your Gruvs display name — used where formality matters, like verification and a landlord&apos;s view of your application. Leave blank to keep using your display name everywhere.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault()
            dispatch(setLegalName(legalName.trim() || undefined))
            setLegalNameSaved(true)
            setTimeout(() => setLegalNameSaved(false), 2500)
          }}
          className="flex items-center gap-2"
        >
          <input
            value={legalName}
            onChange={e => setLegalNameInput(e.target.value)}
            placeholder="e.g. Thandiwe Nkosi"
            className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50"
          />
          <button type="submit" className={goldButtonClass()}>
            {legalNameSaved ? <Check size={14} /> : null}
            {legalNameSaved ? 'Saved' : 'Save'}
          </button>
        </form>
      </Card>

      {hasPlus === false && (
        <div className="glass-panel p-4 flex items-center justify-between gap-4 border-gold-primary/20">
          <div>
            <p className="text-sm font-bold text-white">Household Plus</p>
            <p className="text-[11px] text-gray-500">Boosted listings, priority verification, and more for your household.</p>
          </div>
          <UpgradeButton item="plus" className={`shrink-0 ${goldButtonClass()}`} />
        </div>
      )}

      <Link href="/dashboard/trust-circle" className="glass-panel p-4 flex items-center gap-3 hover:border-gold-primary/30 transition-all">
        <div className="p-2 bg-gold-primary/10 rounded-lg text-gold-primary"><ShieldCheck size={18} /></div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Next of Kin</p>
          <p className="text-[11px] text-gray-500">People to notify if something happens to you</p>
        </div>
      </Link>

      {(currentUser.role === 'landlord' || myServiceOwned) && (
        <Link href="/dashboard/business" className="glass-panel p-4 flex items-center gap-3 hover:border-gold-primary/30 transition-all">
          <div className="p-2 bg-gold-primary/10 rounded-lg text-gold-primary"><Briefcase size={18} /></div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Manage your business</p>
            <p className="text-[11px] text-gray-500">Visibility tier, verification, listings performance</p>
          </div>
        </Link>
      )}

      {currentUser.role === 'tenant' && (
        <form onSubmit={onSaveTenant} className="glass-panel p-6 space-y-5">
          <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
            <UserIcon size={16} /> Tenant Requirement Profile
          </h2>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">About Yourself</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell landlords about yourself, your cleanliness habits, etc."
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value as typeof gender)}
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 cursor-pointer">
                <option value="any">Any / Rather not say</option>
                <option value="men">Male</option>
                <option value="women">Female</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Number of Children</label>
              <input type="number" min={0} value={childrenCount} onChange={e => setChildrenCount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Employment Status</label>
            <select value={employmentStatus} onChange={e => setEmploymentStatus(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 cursor-pointer">
              <option>Employed</option>
              <option>Self-Employed</option>
              <option>Student</option>
              <option>Unemployed</option>
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={hasPets} onChange={e => setHasPets(e.target.checked)} className="accent-gold-primary w-4 h-4" />
            <span className="text-sm text-gray-300">I have pets</span>
          </label>
          <SaveBar saving={saving} saved={saved} />
        </form>
      )}

      {currentUser.role === 'landlord' && (
        <form onSubmit={onSaveLandlord} className="glass-panel p-6 space-y-5">
          <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={16} /> Tenant Preferences
          </h2>
          <p className="text-[11px] text-gray-500 -mt-3">Applied as the default requirements on new listings — each listing can still override these.</p>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Preferred Tenant</label>
            <select value={genderPreference} onChange={e => setGenderPreference(e.target.value as typeof genderPreference)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 cursor-pointer">
              <option value="any">Any</option>
              <option value="men">Male</option>
              <option value="women">Female</option>
              <option value="couple">Couple</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={childrenAllowed} onChange={e => setChildrenAllowed(e.target.checked)} className="accent-gold-primary w-4 h-4" />
              <span className="text-sm text-gray-300">Children allowed</span>
            </label>
            {childrenAllowed && (
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Max Children</label>
                <input type="number" min={0} value={maxChildren} onChange={e => setMaxChildren(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50" />
              </div>
            )}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={smokingAllowed} onChange={e => setSmokingAllowed(e.target.checked)} className="accent-gold-primary w-4 h-4" />
            <span className="text-sm text-gray-300">Smoking allowed</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={petsAllowed} onChange={e => setPetsAllowed(e.target.checked)} className="accent-gold-primary w-4 h-4" />
            <span className="text-sm text-gray-300">Pets allowed</span>
          </label>
          <SaveBar saving={saving} saved={saved} />
        </form>
      )}

      {!isGuestUser(currentUser) && (
        <div className="glass-panel p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white">Verification</p>
            <p className="text-[11px] text-gray-500">Verified residents get priority on requests and dispatches.</p>
            <p className="text-[10px] text-gray-600 mt-1">Free verification always works and arrives regardless — paying only skips the queue, it&apos;s never required to be taken seriously.</p>
          </div>
          <UpgradeButton item="verification_speedup" className={`shrink-0 ${goldButtonClass()}`} />
        </div>
      )}

      {themeCard}
      {languageCard}

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 bg-black border border-red-500/20 hover:border-red-500/50 text-red-400 font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95"
      >
        <LogOut size={14} /> Log Out
      </button>
    </div>
  )
}

function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button type="submit" disabled={saving}
      className="w-full flex items-center justify-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50">
      {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
    </button>
  )
}
