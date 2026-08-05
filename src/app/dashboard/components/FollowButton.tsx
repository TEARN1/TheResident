'use client'

import React, { useEffect, useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { followUser, unfollowUser, isFollowing as checkIsFollowing } from '../../../utils/social'

interface FollowButtonProps {
  targetUserId: string
  currentUserId?: string
  className?: string
}

/**
 * Follows through the shared Gruvs follows table — following someone here
 * follows them there too, same relationship, not a Resident-only copy.
 */
export default function FollowButton({ targetUserId, currentUserId, className }: FollowButtonProps) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!targetUserId || targetUserId === currentUserId) return
    checkIsFollowing(targetUserId).then(result => {
      if (!cancelled) {
        setFollowing(result)
        setChecked(true)
      }
    })
    return () => { cancelled = true }
  }, [targetUserId, currentUserId])

  // Don't show a follow button for yourself, or before we know the target.
  if (!targetUserId || targetUserId === currentUserId) return null

  const toggle = async () => {
    setLoading(true)
    try {
      if (following) {
        await unfollowUser(targetUserId)
        setFollowing(false)
      } else {
        await followUser(targetUserId)
        setFollowing(true)
      }
    } catch {
      // Following is a nice-to-have, not a blocking action — fail quietly
      // rather than interrupt whatever the user was actually doing.
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || !checked}
      className={className || `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
        following
          ? 'bg-white/5 text-gray-400 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
          : 'bg-gold-primary/10 text-gold-primary border border-gold-primary/20 hover:bg-gold-primary hover:text-black'
      }`}
    >
      {following ? <UserCheck size={12} /> : <UserPlus size={12} />}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
