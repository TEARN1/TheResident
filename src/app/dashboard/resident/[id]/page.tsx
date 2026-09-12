'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSelector } from 'react-redux'
import {
  ArrowLeft, BadgeCheck, MapPin, MessageCircle, Loader, ShieldOff, Sparkles, UserRound
} from 'lucide-react'
import { RootState } from '../../../../store'
import BlockUserButton from '../../components/trust-safety/BlockUserButton'
import StatTile, { StatGrid } from '../../../../components/ui/StatTile'
import Avatar from '../../../../components/ui/Avatar'
import Badge from '../../../../components/ui/Badge'
import Button from '../../../../components/ui/Button'
import { humanizeSupabaseError } from '../../../../utils/humanizeError'
import {
  fetchPublicProfile, fetchPublicProfilePosts, nameOf, placeOf,
  memberSinceLabel, roleLabel, hasScore, messageOf, UNAVAILABLE, NOT_SIGNED_IN,
  type PublicProfile, type PublicProfilePost
} from '../../../../utils/publicProfile'

// The page that was missing. Before this, the only thing The Resident could do
// with another person was message them — tapping a name on the gossip feed
// opened a DM, so you had to start a conversation with a stranger in order to
// find out anything about them. For an app whose whole premise is deciding
// whether to share a home with someone, that was backwards.
//
// Every field here comes from res_public_profile (schema part 3, section 46).
// Nothing on this page selects from `profiles` or `res_profiles` directly, and
// it must stay that way: see the docblock in utils/publicProfile.ts for why.

type Status = 'loading' | 'ready' | 'missing' | 'unavailable' | 'signed_out' | 'error'

export default function ResidentProfilePage() {
  const params = useParams()
  const residentId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)
  const myId = useSelector((state: RootState) => state.auth.currentUser?.id)

  const [loadState, setStatus] = useState<Status>('loading')
  // A missing id is a bad link, decided during render rather than by an
  // effect that has to set state to say so.
  const status: Status = residentId ? loadState : 'missing'
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [posts, setPosts] = useState<PublicProfilePost[]>([])
  const [error, setError] = useState<string | null>(null)

  // No setState before the first await. The initial status is already
  // 'loading', and the retry button sets it back itself — calling setState
  // synchronously from an effect body cascades a second render for nothing,
  // which the lint rule is right about.
  const load = useCallback(async () => {
    try {
      // A route with no id renders the unavailable screen without ever
      // getting here — see `status` below — so the first thing this function
      // does is the network call, and no state is set before an await.
      if (!residentId) return
      const p = await fetchPublicProfile(residentId)
      if (!p) { setStatus('missing'); return }
      setProfile(p)
      setStatus('ready')
      // Posts are a second call on purpose: a resident with no posts is a
      // normal, complete profile, so a failure here must not blank the page.
      try {
        setPosts(await fetchPublicProfilePosts(residentId, 20))
      } catch {
        setPosts([])
      }
    } catch (err) {
      const message = messageOf(err)
      if (message.includes(UNAVAILABLE)) { setStatus('unavailable'); return }
      // A guest browsing the app is the single most likely visitor to this
      // page, and "we couldn't load this profile" tells them nothing they can
      // act on. The RPC is authenticated-only by design; say so.
      if (message.includes(NOT_SIGNED_IN)) { setStatus('signed_out'); return }
      setError(humanizeSupabaseError(message))
      setStatus('error')
    }
  }, [residentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-loop risk
    if (residentId) load()
  }, [load, residentId])

  const back = (
    <Link
      href="/dashboard/gossip"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-content-muted hover:text-content min-h-[44px]"
    >
      <ArrowLeft size={14} aria-hidden="true" /> Back
    </Link>
  )

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        {back}
        <div className="glass-panel p-12 text-center text-content-muted flex items-center justify-center gap-2">
          <Loader size={16} className="animate-spin" aria-hidden="true" />
          <span>Loading this neighbour…</span>
        </div>
      </div>
    )
  }

  // Deliberately the same words for "no such person" and "blocked", with a
  // different explanation underneath. Telling a blocked visitor that the
  // account definitely exists is information the person who blocked them did
  // not choose to share.
  if (status === 'missing' || status === 'unavailable') {
    return (
      <div className="space-y-6">
        {back}
        <div className="glass-panel p-10 text-center">
          <ShieldOff size={24} className="text-content-subtle mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-lg font-bold text-content">This profile isn&apos;t available</h1>
          <p className="text-sm text-content-muted mt-2 max-w-sm mx-auto leading-relaxed">
            {status === 'unavailable'
              ? 'You and this resident can’t see each other on The Resident.'
              : 'This resident may have left, or the link may be wrong.'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'signed_out') {
    return (
      <div className="space-y-6">
        {back}
        <div className="glass-panel p-10 text-center">
          <UserRound size={24} className="text-content-subtle mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-lg font-bold text-content">Sign in to see neighbours</h1>
          <p className="text-sm text-content-muted mt-2 max-w-sm mx-auto leading-relaxed">
            Resident profiles are only visible to people with an account. Guests
            can read the gossip feed and browse listings.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center min-h-[44px] px-5 mt-5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-xs font-black uppercase tracking-widest hover:bg-accent/20 transition-all"
          >
            Sign in or sign up
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'error' || !profile) {
    return (
      <div className="space-y-6">
        {back}
        <div className="glass-panel p-10 text-center">
          <h1 className="text-lg font-bold text-content">We couldn&apos;t load this profile</h1>
          <p className="text-sm text-content-muted mt-2">{error || 'Something went wrong.'}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => { setStatus('loading'); load() }}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const name = nameOf(profile)
  const place = placeOf(profile)
  const since = memberSinceLabel(profile.memberSince)
  const role = roleLabel(profile.role)

  return (
    <div className="space-y-6">
      {back}

      <div className="glass-panel p-6">
        <div className="flex items-start gap-4">
          <Avatar src={profile.avatarUrl} name={name} size="lg" />

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-content flex items-center gap-1.5 flex-wrap">
              <span className="break-words">{name}</span>
              {profile.isVerified && (
                <BadgeCheck size={16} className="text-accent flex-shrink-0" aria-label="Verified resident" />
              )}
            </h1>
            {profile.username && profile.displayName && (
              <p className="text-xs text-content-subtle mt-0.5">@{profile.username}</p>
            )}
            {place && (
              <p className="text-xs text-content-muted mt-1.5 flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" /> {place}
              </p>
            )}
            {role && <p className="text-xs text-content-muted mt-1">{role}</p>}
            {since && <p className="text-xs text-content-subtle mt-1">{since}</p>}
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-content-muted leading-relaxed mt-4 whitespace-pre-wrap break-words">
            {profile.bio}
          </p>
        )}

        {profile.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {profile.badges.map(b => (
              <Badge key={b} tone="accent" icon={<Sparkles size={10} aria-hidden="true" />}>
                {b}
              </Badge>
            ))}
          </div>
        )}

        {/* Scores render only when the database has one. A missing score shown
            as 0 says "this person scored zero", which is a claim, not a blank. */}
        {/* Scores render only when the database has one. A missing score shown
            as 0 says "this person scored zero", which is a claim, not a blank. */}
        <StatGrid className="mt-5">
          <StatTile label="Posts" value={String(profile.gossipPostCount)} />
          {hasScore(profile.vibeScore) && <StatTile label="Vibe" value={String(profile.vibeScore)} />}
          {hasScore(profile.socialIntegrityScore) && (
            <StatTile label="Integrity" value={String(profile.socialIntegrityScore)} />
          )}
          {hasScore(profile.xp) && <StatTile label="XP" value={String(profile.xp)} />}
        </StatGrid>

        {!profile.isSelf && (
          <div className="flex items-center gap-3 flex-wrap mt-5 pt-5 border-t border-subtle">
            <Link
              href={`/dashboard/messages/${profile.id}`}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-accent/10 text-accent border border-accent/20 text-xs font-black uppercase tracking-widest hover:bg-accent/20 transition-all"
            >
              <MessageCircle size={14} aria-hidden="true" /> Message
            </Link>
            <BlockUserButton targetUserId={profile.id} currentUserId={myId} />
          </div>
        )}

        {profile.isSelf && (
          <div className="mt-5 pt-5 border-t border-subtle">
            <Link href="/dashboard/profile" className="text-xs font-bold text-accent hover:underline min-h-[44px] inline-flex items-center">
              This is how neighbours see you — edit your profile
            </Link>
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-content-subtle mb-4">
          Gossip posts
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-content-subtle italic">
            {profile.isSelf ? 'You haven’t posted yet.' : 'Nothing posted yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="p-4 rounded-xl bg-surface-sunken/40 border border-subtle">
                {post.body && (
                  <p className="text-sm text-content whitespace-pre-wrap break-words">{post.body}</p>
                )}
                {post.mediaUrl && post.mediaType === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.mediaUrl} alt="" className="mt-3 rounded-lg w-full object-cover max-h-72" />
                )}
                <p className="text-[10px] text-content-subtle mt-2">
                  {new Date(post.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
