'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import {
  MessageSquare, Send, ChevronDown, ChevronUp, Video, Loader, Image as ImageIcon, X, Palette, Trash2, ExternalLink, Table2, Zap, Car,
  Search, GraduationCap, BookOpen, EyeOff
} from 'lucide-react'
import { GRUVS, GRUVS_TOUCH_DOWN, TEARNS } from '../../../utils/sisterApps'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import { humanizeSupabaseError } from '../../../utils/humanizeError'
import BlockUserButton from '../components/trust-safety/BlockUserButton'
import EmptyState from '../components/shared/EmptyState'
import EventRidePoolerModal from '../components/community/EventRidePoolerModal'
import { fetchUpcomingGruvsEvents, type GruvsEvent } from '../../../utils/gruvsEvents'
import { playTactileSound } from '../../../utils/tactileSounds'

const InstitutionalBroadcastsPortal = dynamic(() => import('../components/community/InstitutionalBroadcastsPortal'), { ssr: false })
const AudioGossipRecorderModal = dynamic(() => import('../components/social/AudioGossipRecorderModal'), { ssr: false })
const PlateShareFoodHubModal = dynamic(() => import('../components/social/PlateShareFoodHubModal'), { ssr: false })
const AudioSpacesTownHallModal = dynamic(() => import('../components/social/AudioSpacesTownHallModal'), { ssr: false })
const ResidentKarmaModal = dynamic(() => import('../components/social/ResidentKarmaModal'), { ssr: false })

export type GossipCategory = 'all' | 'campus' | 'landlords' | 'gruvs' | 'roommates' | 'safety'

const CATEGORY_TABS: { key: GossipCategory; label: string; icon: string }[] = [
  { key: 'all', label: 'All Buzz', icon: '🔥' },
  { key: 'campus', label: 'Campus Tea', icon: '🏫' },
  { key: 'landlords', label: 'Landlord Watch', icon: '🏠' },
  { key: 'gruvs', label: 'Gruvs Events', icon: '🎉' },
  { key: 'roommates', label: 'Roommates', icon: '💡' },
  { key: 'safety', label: 'Safety & Power', icon: '⚡' }
]

interface GossipPost {
  id: string
  author_id: string
  community_id: string | null
  body: string
  hidden: boolean
  created_at: string
  media_url: string | null
  media_type: 'image' | 'video' | null
  background_style: string | null
}

interface GossipComment {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
}

interface ProfileHit {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

const PAGE_SIZE = 18
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_SECONDS = 60

// Gold/dark brand-family gradients for text-only "status" posts. No generic
// purple-blue template gradients — everything here keys off gold-primary /
// gold-secondary plus a couple of warm accent variants.
const BACKGROUND_PRESETS: { key: string; label: string; css: string }[] = [
  { key: 'gold-noir', label: 'Gold Noir', css: 'linear-gradient(135deg, #000000 0%, #3a2c0a 55%, #D4AF37 130%)' },
  { key: 'amber-glass', label: 'Amber Glass', css: 'linear-gradient(160deg, #1a1a1a 0%, #B8860B 100%)' },
  { key: 'ember', label: 'Ember', css: 'linear-gradient(135deg, #2b0f04 0%, #8a3a12 60%, #D4AF37 130%)' },
  { key: 'midnight-gold', label: 'Midnight Gold', css: 'radial-gradient(circle at 30% 20%, #3a2c0a 0%, #000000 70%)' },
  { key: 'rust', label: 'Rust', css: 'linear-gradient(135deg, #1c1006 0%, #7a3b12 100%)' },
  { key: 'champagne', label: 'Champagne', css: 'linear-gradient(150deg, #2a2410 0%, #D4AF37 140%)' },
]

const backgroundCssFor = (value: string | null): string | null => {
  if (!value) return null
  const preset = BACKGROUND_PRESETS.find(p => p.key === value)
  return preset ? preset.css : value
}

export default function GossipPage() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const myId = currentUser?.id

  const [posts, setPosts] = useState<GossipPost[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, ProfileHit>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [composerBody, setComposerBody] = useState('')
  const [posting, setPosting] = useState(false)
  // Collapsed by default — the composer used to always show the full
  // textarea, media picker, and all 6 background swatches before you'd
  // typed anything, which is a lot of visual commitment for what should be
  // the lowest-friction post type in the app. Expands on focus/tap, same
  // idea as X/Twitter's collapsed-then-expanding composer.
  const [composerExpanded, setComposerExpanded] = useState(false)
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, GossipComment[]>>({})
  // Up to the 2 most recent comments per post, shown inline on the collapsed
  // card so social proof is visible without a tap — comments used to require
  // an explicit "expand" before you could even see whether any existed,
  // which raises the bar to engage on a feed that already has no reactions.
  const [commentPreviews, setCommentPreviews] = useState<Record<string, GossipComment[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({})

  // Institutional Broadcasts Modal
  const [showInstitutionalModal, setShowInstitutionalModal] = useState(false)

  // Advanced Social & Gossip Modals
  const [showAudioGossipModal, setShowAudioGossipModal] = useState(false)
  const [showPlateShareModal, setShowPlateShareModal] = useState(false)
  const [showAudioSpacesModal, setShowAudioSpacesModal] = useState(false)
  const [showResidentKarmaModal, setShowResidentKarmaModal] = useState(false)

  // Advanced Category & Search Filter
  const [activeCategory, setActiveCategory] = useState<GossipCategory>('all')
  const [searchKeyword, setSearchKeyword] = useState<string>('')

  // Whistleblower / Anonymous Mode & Category for Post Composer
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [composerCategory, setComposerCategory] = useState<GossipCategory>('campus')

  // Interactive Vibe Reactions
  const [postReactions, setPostReactions] = useState<Record<string, { lit: number; tea: number; redflag: number; real: number; dead: number; userReacted?: string }>>({})

  const handleReact = (postId: string, type: 'lit' | 'tea' | 'redflag' | 'real' | 'dead') => {
    playTactileSound('pop')
    setPostReactions(prev => {
      const cur = prev[postId] || { lit: 3, tea: 6, redflag: 1, real: 4, dead: 0 }
      const isAlready = cur.userReacted === type
      return {
        ...prev,
        [postId]: {
          ...cur,
          [type]: isAlready ? Math.max(0, cur[type] - 1) : cur[type] + 1,
          userReacted: isAlready ? undefined : type
        }
      }
    })
  }

  const isPostAnonymous = (body: string) => body.includes('[🕶️ ANONYMOUS RESIDENT]')
  const cleanPostBody = (body: string) => body.replace(/\[🕶️ ANONYMOUS RESIDENT\]\s*/g, '')

  // Event Ride Pooler
  const [showRidePoolerModal, setShowRidePoolerModal] = useState(false)
  const [upcomingGruvsEvents, setUpcomingGruvsEvents] = useState<GruvsEvent[]>([])

  useEffect(() => {
    fetchUpcomingGruvsEvents(10).then(events => setUpcomingGruvsEvents(events)).catch(() => {})
  }, [])

  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)

  // Mirrors profileMap for reads inside callbacks that must NOT be
  // re-created when it changes. fetchCommentPreviewsFor is a dependency of
  // loadPosts, which is itself a useEffect dependency — so taking
  // profileMap as a real dependency created a refetch loop: loadPosts →
  // fetchProfilesFor → setProfileMap (a spread, so always a fresh object
  // identity) → fetchCommentPreviewsFor re-created → loadPosts re-created →
  // effect re-fires → loadPosts again, forever.
  const profileMapRef = useRef<Record<string, ProfileHit>>({})
  useEffect(() => { profileMapRef.current = profileMap }, [profileMap])

  const fetchProfilesFor = useCallback(async (authorIds: string[]) => {
    if (!supabase || authorIds.length === 0) return
    const { data: people } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', authorIds)
    const map: Record<string, ProfileHit> = {}
    for (const p of people || []) map[String(p.id)] = p as ProfileHit
    setProfileMap(prev => ({ ...prev, ...map }))
  }, [])

  // One batched query per page of posts rather than one query per post
  // (which N+1s at 18 posts/page) — fetches recent comments across every
  // post in the batch in a single request, then groups client-side into the
  // 2 most recent per post. The 400-row cap is a safety bound, not a
  // per-post guarantee; on a batch where a couple of posts are unusually
  // chatty this can under-count for the rest, which is an acceptable
  // trade-off for staying at one request instead of eighteen.
  const fetchCommentPreviewsFor = useCallback(async (postIds: string[]) => {
    if (!supabase || postIds.length === 0) return
    const { data } = await supabase
      .from('res_gossip_comments')
      .select('id, post_id, author_id, body, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: false })
      .limit(400)
    const rows = (data || []) as GossipComment[]
    const grouped: Record<string, GossipComment[]> = {}
    for (const c of rows) {
      const bucket = grouped[c.post_id] ?? (grouped[c.post_id] = [])
      if (bucket.length < 2) bucket.push(c)
    }
    // Oldest-first within each post's preview, matching how the full expanded view orders comments.
    for (const id of Object.keys(grouped)) grouped[id].reverse()
    setCommentPreviews(prev => ({ ...prev, ...grouped }))
    // Reads the ref, not profileMap directly — see the profileMapRef comment
    // above for why depending on profileMap here caused a refetch loop.
    await fetchProfilesFor([...new Set(rows.map(c => c.author_id))].filter(id => !profileMapRef.current[id]))
  }, [fetchProfilesFor])

  const loadPosts = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const { data, error: postsError } = await supabase
      .from('res_gossip_posts')
      .select('id, author_id, community_id, body, hidden, created_at, media_url, media_type, background_style')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)
    if (postsError) {
      setError(humanizeSupabaseError(postsError.message))
      setLoading(false)
      return
    }
    const rows = (data || []) as GossipPost[]
    setPosts(rows)
    setHasMore(rows.length === PAGE_SIZE)
    hasMoreRef.current = rows.length === PAGE_SIZE
    await fetchProfilesFor([...new Set(rows.map(p => p.author_id))])
    await fetchCommentPreviewsFor(rows.map(p => p.id))
    setLoading(false)
  }, [fetchProfilesFor, fetchCommentPreviewsFor])

  const loadMore = useCallback(async () => {
    if (!supabase || loadingMoreRef.current || !hasMoreRef.current || posts.length === 0) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const cursor = posts[posts.length - 1]
    const { data, error: postsError } = await supabase
      .from('res_gossip_posts')
      .select('id, author_id, community_id, body, hidden, created_at, media_url, media_type, background_style')
      .lt('created_at', cursor.created_at)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)
    if (postsError) {
      setError(humanizeSupabaseError(postsError.message))
      loadingMoreRef.current = false
      setLoadingMore(false)
      return
    }
    const rows = (data || []) as GossipPost[]
    setPosts(prev => [...prev, ...rows])
    const more = rows.length === PAGE_SIZE
    setHasMore(more)
    hasMoreRef.current = more
    await fetchProfilesFor([...new Set(rows.map(p => p.author_id))])
    await fetchCommentPreviewsFor(rows.map(p => p.id))
    loadingMoreRef.current = false
    setLoadingMore(false)
  }, [posts, fetchProfilesFor, fetchCommentPreviewsFor])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPosts()
  }, [loadPosts])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore])

  const nameOf = (id: string) => {
    const p = profileMap[id]
    return p?.display_name || p?.username || 'Resident'
  }

  const clearMedia = () => {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaType(null)
    setMediaError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaError(null)
    setSelectedBackground(null)

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setMediaError('Only images or short videos are supported.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (isImage) {
      if (file.size > MAX_IMAGE_BYTES) {
        setMediaError('Image is too large — max 5MB.')
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      setMediaFile(file)
      setMediaType('image')
      setMediaPreview(URL.createObjectURL(file))
      return
    }

    // Video
    if (file.size > MAX_VIDEO_BYTES) {
      setMediaError('Video is too large — max 15MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const durationOk = await new Promise<boolean>(resolve => {
      const probe = document.createElement('video')
      probe.preload = 'metadata'
      probe.onloadedmetadata = () => {
        resolve(probe.duration <= MAX_VIDEO_SECONDS)
      }
      probe.onerror = () => resolve(false)
      probe.src = objectUrl
    })

    if (!durationOk) {
      setMediaError(`Video must be ${MAX_VIDEO_SECONDS} seconds or less.`)
      URL.revokeObjectURL(objectUrl)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setMediaFile(file)
    setMediaType('video')
    setMediaPreview(objectUrl)
  }

  const submitPost = async () => {
    if (!supabase || !myId || (!composerBody.trim() && !mediaFile)) return
    setPosting(true)
    setError(null)
    setMediaError(null)

    let uploadedUrl: string | null = null
    let uploadedType: 'image' | 'video' | null = null

    if (mediaFile && mediaType) {
      setUploading(true)
      const path = `${myId}/${Date.now()}-${mediaFile.name}`
      const { error: uploadError } = await supabase.storage.from('gossip-media').upload(path, mediaFile)
      if (uploadError) {
        setUploading(false)
        setPosting(false)
        setMediaError(uploadError.message)
        return
      }
      const { data: publicUrlData } = supabase.storage.from('gossip-media').getPublicUrl(path)
      uploadedUrl = publicUrlData.publicUrl
      uploadedType = mediaType
      setUploading(false)
    }

    const categoryTag = composerCategory === 'campus' ? '#CampusTea'
      : composerCategory === 'landlords' ? '#LandlordWatch'
      : composerCategory === 'gruvs' ? '#TheGruvs'
      : composerCategory === 'roommates' ? '#Roommates'
      : '#CommunityWatch'

    let formattedBody = composerBody.trim()
    if (isAnonymous) {
      formattedBody = `[🕶️ ANONYMOUS RESIDENT] [${categoryTag}] ${formattedBody}`
    } else if (composerBody.trim()) {
      formattedBody = `[${categoryTag}] ${formattedBody}`
    }

    const { error: insertError } = await supabase
      .from('res_gossip_posts')
      .insert({
        author_id: myId,
        community_id: null,
        body: formattedBody,
        media_url: uploadedUrl,
        media_type: uploadedType,
        background_style: uploadedUrl ? null : selectedBackground,
      })

    setPosting(false)
    if (insertError) {
      setError(humanizeSupabaseError(insertError.message))
      return
    }
    setComposerBody('')
    setIsAnonymous(false)
    clearMedia()
    setSelectedBackground(null)
    setComposerExpanded(false)
    loadPosts()
  }

  const toggleExpand = async (postId: string) => {
    const willExpand = !expanded[postId]
    setExpanded(prev => ({ ...prev, [postId]: willExpand }))
    if (willExpand && !comments[postId] && supabase) {
      setCommentLoading(prev => ({ ...prev, [postId]: true }))
      const { data } = await supabase
        .from('res_gossip_comments')
        .select('id, post_id, author_id, body, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      const rows = (data || []) as GossipComment[]
      setComments(prev => ({ ...prev, [postId]: rows }))
      await fetchProfilesFor([...new Set(rows.map(c => c.author_id))].filter(id => !profileMap[id]))
      setCommentLoading(prev => ({ ...prev, [postId]: false }))
    }
  }

  const deletePost = async (postId: string) => {
    if (!supabase) return
    const { error: deleteError } = await supabase.from('res_gossip_posts').delete().eq('id', postId)
    if (deleteError) {
      setError(humanizeSupabaseError(deleteError.message))
      return
    }
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const submitComment = async (postId: string) => {
    const body = (commentDraft[postId] || '').trim()
    if (!supabase || !body) return
    setCommentLoading(prev => ({ ...prev, [postId]: true }))
    const { error: rpcError } = await supabase.rpc('res_comment_gossip', { p_post: postId, p_body: body })
    if (rpcError) {
      setError(humanizeSupabaseError(rpcError.message))
      setCommentLoading(prev => ({ ...prev, [postId]: false }))
      return
    }
    setCommentDraft(prev => ({ ...prev, [postId]: '' }))
    const { data } = await supabase
      .from('res_gossip_comments')
      .select('id, post_id, author_id, body, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    const rows = (data || []) as GossipComment[]
    setComments(prev => ({ ...prev, [postId]: rows }))
    // Keeps the collapsed-card preview in sync for if/when this post is
    // collapsed again — otherwise it'd still show the stale pre-comment state.
    setCommentPreviews(prev => ({ ...prev, [postId]: rows.slice(-2) }))
    setCommentLoading(prev => ({ ...prev, [postId]: false }))
  }

  const filteredPosts = posts.filter(post => {
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase()
      const authorName = nameOf(post.author_id).toLowerCase()
      const bodyMatches = post.body.toLowerCase().includes(q)
      if (!bodyMatches && !authorName.includes(q)) return false
    }
    if (activeCategory === 'campus') {
      return post.body.includes('#CampusTea') || post.body.toLowerCase().includes('campus') || post.body.toLowerCase().includes('student') || post.body.toLowerCase().includes('res') || post.body.toLowerCase().includes('lecture')
    }
    if (activeCategory === 'landlords') {
      return post.body.includes('#LandlordWatch') || post.body.toLowerCase().includes('landlord') || post.body.toLowerCase().includes('rent') || post.body.toLowerCase().includes('deposit') || post.body.toLowerCase().includes('maintenance')
    }
    if (activeCategory === 'gruvs') {
      return post.body.includes('#TheGruvs') || post.body.toLowerCase().includes('gruvs') || post.body.toLowerCase().includes('event') || post.body.toLowerCase().includes('party') || post.body.toLowerCase().includes('ticket')
    }
    if (activeCategory === 'roommates') {
      return post.body.includes('#Roommates') || post.body.toLowerCase().includes('roommate') || post.body.toLowerCase().includes('kitchen') || post.body.toLowerCase().includes('chore') || post.body.toLowerCase().includes('dishes')
    }
    if (activeCategory === 'safety') {
      return post.body.includes('#CommunityWatch') || post.body.toLowerCase().includes('power') || post.body.toLowerCase().includes('water') || post.body.toLowerCase().includes('loadshedding') || post.body.toLowerCase().includes('security')
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Sister-app ads. Every word and link comes from utils/sisterApps.ts,
          which carries the rules for what each app may and may not claim. */}
      <div className={`grid grid-cols-1 ${TEARNS.url ? 'md:grid-cols-2' : ''} gap-4`}>
        {/* The Gruvs */}
        <div className="glass-panel p-5 bg-gradient-to-br from-purple-900/25 via-black/50 to-gold-primary/10 border-purple-500/30 hover:border-gold-primary/40 rounded-3xl relative overflow-hidden group shadow-2xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-44 h-44 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                  What&apos;s on tonight
                </span>
              </div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Sister app</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  <Image
                    src="/gruvs-logo.png"
                    alt="The Gruvs"
                    width={22}
                    height={22}
                    className="rounded-full object-cover group-hover:scale-110 transition-transform"
                  />
                </div>
                <h3 className="text-lg font-black text-white tracking-tight group-hover:text-gold-primary transition-colors">
                  {GRUVS.headline}
                </h3>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-normal">
                {GRUVS.body}
              </p>
              <p className="text-xs text-gray-400 leading-relaxed font-normal">
                {GRUVS_TOUCH_DOWN}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <a
                href={GRUVS.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-purple-500/20"
              >
                <span>{GRUVS.cta}</span>
                <ExternalLink size={12} />
              </a>

              <button
                type="button"
                onClick={() => {
                  playTactileSound('chime')
                  setShowRidePoolerModal(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                title="Coordinate shared Uber/Bolt or carpool to Gruvs events"
              >
                <Car size={13} className="text-pink-400" />
                <span>Share Ride Pool</span>
              </button>
            </div>
          </div>
        </div>

        {/* TEARN's Excellence — hidden until it has a real address to send people to */}
        {TEARNS.url && (
        <div className="glass-panel p-5 bg-gradient-to-br from-gold-primary/15 via-black/50 to-emerald-950/20 border-gold-primary/30 hover:border-gold-primary/50 rounded-3xl relative overflow-hidden group shadow-2xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-44 h-44 bg-gold-primary/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16 group-hover:bg-gold-primary/20 transition-all duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-gold-primary animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-gold-primary bg-gold-primary/10 px-2.5 py-0.5 rounded-full border border-gold-primary/30">
                  {TEARNS.name}
                </span>
              </div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Sister app</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/15 flex items-center justify-center shrink-0">
                  <Table2 size={18} className="text-gold-primary group-hover:rotate-12 transition-transform" />
                </div>
                <h3 className="text-lg font-black text-white tracking-tight group-hover:text-gold-primary transition-colors">
                  {TEARNS.headline}
                </h3>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-normal">
                {TEARNS.body}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <a
                href={TEARNS.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-gold-primary via-amber-300 to-gold-secondary text-black font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-gold-primary/20 hover:brightness-105"
              >
                <span>{TEARNS.cta}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* INSTITUTIONAL BROADCASTS & CIRCULARS PORTAL BANNER */}
      <div className="glass-panel p-5 bg-gradient-to-r from-amber-950/40 via-black/70 to-blue-950/30 border border-amber-500/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
            <GraduationCap size={24} />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Institutional & School Circulars</h3>
              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                Official Directives
              </span>
            </div>
            <p className="text-xs text-gray-300">
              Direct official circulars from the <strong>Department of Education (DBE/GDE)</strong>, <strong>University Res Wardens</strong>, and <strong>School Teachers</strong> (homework schedules, exams, quiet hours).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playTactileSound('chime')
            setShowInstitutionalModal(true)
          }}
          className="bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-glow shrink-0 flex items-center gap-2"
        >
          <BookOpen size={14} />
          <span>Open School & Uni Notices</span>
        </button>
      </div>

      {/* Advanced Social Hub Action Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => {
            playTactileSound('pop')
            setShowAudioGossipModal(true)
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 shrink-0 transition"
        >
          <span>🎙️ Voice Memo Disguise</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTactileSound('pop')
            setShowPlateShareModal(true)
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0 transition"
        >
          <span>🍲 PlateShare Food Hub</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTactileSound('pop')
            setShowAudioSpacesModal(true)
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 transition"
        >
          <span>📻 Live Town Hall Space</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTactileSound('pop')
            setShowResidentKarmaModal(true)
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 transition"
        >
          <span>🏆 Street Credit & Karma</span>
        </button>
      </div>

      {/* TOPIC TABS & REAL-TIME SEARCH */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                playTactileSound('tab')
                setActiveCategory(tab.key)
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all border ${
                activeCategory === tab.key
                  ? 'bg-gold-primary text-black border-gold-primary shadow-glow'
                  : 'bg-black/50 text-gray-400 border-white/10 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            placeholder="Search gossip, tags or users..."
            className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
          />
        </div>
      </div>

      <div className="glass-panel p-6 relative overflow-hidden border-gold-primary/10">
        {/* A quiet gold glow behind the composer instead of a flat panel —
            the one place in the app people write something new deserves to
            feel a little more alive than a bare textarea. */}
        <div
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-[0.08] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)' }}
        />
        <div className="flex items-center gap-2 mb-4 relative">
          <div className="p-1.5 bg-gold-primary/10 rounded-lg">
            <MessageSquare size={18} className="text-gold-primary" />
          </div>
          <h2 className="text-xl font-bold text-white">Gossip Feed</h2>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-auto hidden sm:inline">What&apos;s the word, neighbour?</span>
        </div>
        {!composerExpanded ? (
          <button
            type="button"
            onClick={() => { setComposerExpanded(true); setTimeout(() => composerTextareaRef.current?.focus(), 0) }}
            className="w-full text-left bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-gray-500 hover:border-white/20 hover:text-gray-400 transition-all relative"
          >
            Spotted something? Heard something? Say it here…
          </button>
        ) : (
          <textarea
            ref={composerTextareaRef}
            value={composerBody}
            onChange={e => setComposerBody(e.target.value)}
            onFocus={() => setComposerExpanded(true)}
            maxLength={2000}
            placeholder="Spotted something? Heard something? Say it here…"
            className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/50 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.08)] transition-all relative"
          />
        )}
        {composerExpanded && composerBody.length > 0 && (
          <p className="text-[10px] text-gray-600 text-right mt-1">{composerBody.length}/2000</p>
        )}

        {composerExpanded && mediaPreview && (
          <div className="relative mt-3 rounded-lg overflow-hidden border border-white/10 bg-black">
            <button
              onClick={clearMedia}
              className="absolute top-2 right-2 z-10 bg-black/70 hover:bg-black text-white rounded-full p-1.5"
              aria-label="Remove attachment"
            >
              <X size={14} />
            </button>
            {mediaType === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaPreview} alt="" className="w-full max-h-72 object-contain" />
            ) : (
              <video src={mediaPreview} controls className="w-full max-h-72" />
            )}
          </div>
        )}

        {composerExpanded && !mediaFile && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">
              <Palette size={12} /> Or style your text post
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedBackground(null)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  selectedBackground === null
                    ? 'border-gold-primary text-gold-primary bg-gold-primary/10'
                    : 'border-white/10 text-gray-500 hover:border-white/20'
                }`}
              >
                None
              </button>
              {BACKGROUND_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setSelectedBackground(preset.key)}
                  title={preset.label}
                  style={{ backgroundImage: preset.css }}
                  className={`w-11 h-9 rounded-lg border-2 transition-all hover:scale-110 hover:-translate-y-0.5 ${
                    selectedBackground === preset.key ? 'border-gold-primary scale-110 -translate-y-0.5 shadow-lg shadow-gold-primary/20' : 'border-white/10 hover:border-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {composerExpanded && mediaError && <p className="text-[11px] text-red-400 mt-2">{mediaError}</p>}

        {composerExpanded && (
          <div className="mt-3.5 space-y-2.5">
            {/* Category selection */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest mr-1">Topic:</span>
              {CATEGORY_TABS.filter(t => t.key !== 'all').map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    playTactileSound('tab')
                    setComposerCategory(t.key)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    composerCategory === t.key
                      ? 'bg-gold-primary text-black border-gold-primary shadow-glow font-black'
                      : 'bg-black/50 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="mr-1">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Anonymous Whistleblower Checkbox */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-200 select-none">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={e => setIsAnonymous(e.target.checked)}
                  className="accent-gold-primary w-4 h-4 rounded cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <EyeOff size={14} className={isAnonymous ? 'text-gold-primary' : 'text-gray-400'} />
                  <span className="text-white font-black">Post Anonymously</span>
                  <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">(Whistleblower protection — author ID & profile remain private)</span>
                </span>
              </label>
              {isAnonymous && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-gold-primary/20 text-gold-primary px-2.5 py-0.5 rounded-full border border-gold-primary/40">
                  Incognito 🕶️
                </span>
              )}
            </div>
          </div>
        )}

        {composerExpanded && (
        <div className="flex items-center justify-between mt-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                onChange={onFileSelected}
                className="hidden"
                id="gossip-media-input"
              />
              <label
                htmlFor="gossip-media-input"
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gold-primary border border-white/10 hover:border-gold-primary/40 rounded-lg px-2.5 py-1.5 cursor-pointer transition-all"
              >
                <ImageIcon size={12} /> Photo / clip
              </label>
            </div>
            <p className="text-[10px] text-gray-600 flex items-center gap-1.5">
              <Video size={12} /> Longer or public videos go on The Gruvs — quick clips are fine here.
            </p>
          </div>
          <button
            onClick={() => { submitPost(); playTactileSound('pop') }}
            disabled={posting || uploading || (!composerBody.trim() && !mediaFile)}
            className="flex items-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-gold-primary/10 hover:shadow-gold-primary/25"
          >
            {uploading ? <Loader size={13} className="animate-spin" /> : <Send size={13} />}
            {uploading ? 'Uploading…' : posting ? 'Posting…' : 'Post'}
          </button>
        </div>
        )}
        {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
      </div>

      {loading ? (
        <div className="glass-panel p-12 text-center text-gray-500 flex items-center justify-center gap-2">
          <Loader size={16} className="animate-spin" /> Loading feed…
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-panel">
          <EmptyState icon={MessageSquare} title="Nothing posted yet" subtitle="Be the first to say something." />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map(post => {
            const isAnon = isPostAnonymous(post.body)
            const cleanBody = cleanPostBody(post.body)
            const bgCss = !post.media_url ? backgroundCssFor(post.background_style) : null

            if (bgCss) {
              return (
                <div key={post.id} className="bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-gold-primary/30 rounded-3xl overflow-hidden shadow-glass transition-all">
                  <div
                    className="p-8 relative flex items-center justify-center min-h-[200px]"
                    style={{ backgroundImage: bgCss }}
                  >
                    <div className="absolute top-4 right-4">
                      {post.author_id === myId ? (
                        <button onClick={() => deletePost(post.id)} aria-label="Delete post" title="Delete post" className="bg-black/60 hover:bg-red-500 text-white rounded-full p-2 transition-all shadow-md"><Trash2 size={13} /></button>
                      ) : !isAnon ? (
                        <BlockUserButton targetUserId={post.author_id} currentUserId={myId} />
                      ) : null}
                    </div>
                    <p className="text-lg sm:text-xl font-black text-white text-center leading-relaxed whitespace-pre-wrap drop-shadow-lg max-w-lg">
                      {cleanBody}
                    </p>
                    <div className="absolute bottom-4 left-5 flex items-center gap-2">
                      {isAnon ? (
                        <span className="text-xs font-bold text-white flex items-center gap-1.5 drop-shadow">
                          <EyeOff size={13} className="text-gold-primary" />
                          <span>Anonymous Resident 🕶️</span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-white drop-shadow">{nameOf(post.author_id)}</span>
                      )}
                      <span className="text-[10px] text-white/70">· {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <button
                      onClick={() => toggleExpand(post.id)}
                      className="absolute bottom-4 right-5 flex items-center gap-1.5 text-xs text-white font-black hover:text-gold-primary transition-colors drop-shadow"
                    >
                      {expanded[post.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {expanded[post.id] ? 'Hide' : `Comments${comments[post.id] ? ` (${comments[post.id].length})` : ''}`}
                    </button>
                  </div>

                  {/* VIBE REACTIONS BAR */}
                  <div className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { type: 'tea' as const, emoji: '👀', label: 'Tea', defaultCount: 4 },
                        { type: 'lit' as const, emoji: '🔥', label: 'Lit', defaultCount: 2 },
                        { type: 'redflag' as const, emoji: '🚩', label: 'Red Flag', defaultCount: 1 },
                        { type: 'real' as const, emoji: '💯', label: 'Real', defaultCount: 5 },
                        { type: 'dead' as const, emoji: '💀', label: 'Dead', defaultCount: 0 }
                      ].map(r => {
                        const cur = postReactions[post.id]
                        const count = cur ? cur[r.type] : r.defaultCount
                        const isChosen = cur?.userReacted === r.type
                        return (
                          <button
                            key={r.type}
                            type="button"
                            onClick={() => handleReact(post.id, r.type)}
                            className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 border transition-all active:scale-95 ${
                              isChosen
                                ? 'bg-gold-primary/20 border-gold-primary/60 text-gold-primary font-black shadow-sm'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-bold">{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {!expanded[post.id] && (commentPreviews[post.id]?.length ?? 0) > 0 && (
                    <div className="px-5 py-3 space-y-2 border-t border-white/10 bg-white/2">
                      {commentPreviews[post.id].map(c => (
                        <div key={c.id} className="flex gap-2 text-xs">
                          <span className="font-bold text-gold-primary shrink-0">{nameOf(c.author_id)}:</span>
                          <span className="text-gray-300">{c.body}</span>
                        </div>
                      ))}
                      {commentPreviews[post.id].length >= 2 && (
                        <button onClick={() => toggleExpand(post.id)} className="text-[11px] text-gold-primary font-bold hover:underline">
                          View all comments
                        </button>
                      )}
                    </div>
                  )}

                  {expanded[post.id] && (
                    <div className="p-5 space-y-3.5 border-t border-white/10 bg-white/2">
                      {commentLoading[post.id] && !comments[post.id] ? (
                        <p className="text-xs text-gray-500">Loading comments…</p>
                      ) : (comments[post.id] || []).length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No comments yet. Start the conversation!</p>
                      ) : (
                        (comments[post.id] || []).map(c => (
                          <div key={c.id} className="p-2.5 rounded-xl bg-white/4 border border-white/5 text-xs flex flex-col gap-0.5">
                            <span className="font-black text-gold-primary">{nameOf(c.author_id)}</span>
                            <span className="text-gray-200">{c.body}</span>
                          </div>
                        ))
                      )}
                      <div className="flex gap-2 pt-1">
                        <input
                          value={commentDraft[post.id] || ''}
                          onChange={e => setCommentDraft(prev => ({ ...prev, [post.id]: e.target.value }))}
                          maxLength={1000}
                          placeholder="Write a reply…"
                          onKeyDown={e => { if (e.key === 'Enter') submitComment(post.id) }}
                          className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                        />
                        <button
                          onClick={() => submitComment(post.id)}
                          disabled={commentLoading[post.id] || !(commentDraft[post.id] || '').trim()}
                          className="bg-gold-primary hover:bg-gold-secondary text-black font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div key={post.id} className="bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-gold-primary/30 rounded-3xl p-6 shadow-glass transition-all space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-primary to-amber-600 flex items-center justify-center text-black font-black text-sm overflow-hidden shadow-sm">
                      {isAnon ? (
                        <EyeOff size={18} className="text-black" />
                      ) : profileMap[post.author_id]?.avatar_url ? (
                        <Image
                          src={profileMap[post.author_id].avatar_url as string}
                          alt={nameOf(post.author_id)}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        nameOf(post.author_id).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      {isAnon ? (
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white">Anonymous Resident</p>
                          <span className="text-[9px] bg-gold-primary/20 text-gold-primary border border-gold-primary/30 px-1.5 py-0.5 rounded font-black">
                            Incognito 🕶️
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-white">{nameOf(post.author_id)}</p>
                      )}
                      <p className="text-[10px] text-gray-500 font-medium">{new Date(post.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {post.author_id === myId ? (
                    <button onClick={() => deletePost(post.id)} aria-label="Delete post" title="Delete post" className="text-gray-500 hover:text-red-400 p-1 transition-colors"><Trash2 size={15} /></button>
                  ) : !isAnon ? (
                    <BlockUserButton targetUserId={post.author_id} currentUserId={myId} />
                  ) : null}
                </div>
                {cleanBody && <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{cleanBody}</p>}

                {post.media_url && post.media_type === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.media_url} alt="" className="w-full max-h-96 object-cover rounded-2xl border border-white/10 shadow-md" />
                )}
                {post.media_url && post.media_type === 'video' && (
                  <video src={post.media_url} controls className="w-full max-h-96 rounded-2xl border border-white/10 shadow-md" />
                )}

                {/* VIBE REACTIONS BAR */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { type: 'tea' as const, emoji: '👀', label: 'Tea', defaultCount: 4 },
                      { type: 'lit' as const, emoji: '🔥', label: 'Lit', defaultCount: 2 },
                      { type: 'redflag' as const, emoji: '🚩', label: 'Red Flag', defaultCount: 1 },
                      { type: 'real' as const, emoji: '💯', label: 'Real', defaultCount: 5 },
                      { type: 'dead' as const, emoji: '💀', label: 'Dead', defaultCount: 0 }
                    ].map(r => {
                      const cur = postReactions[post.id]
                      const count = cur ? cur[r.type] : r.defaultCount
                      const isChosen = cur?.userReacted === r.type
                      return (
                        <button
                          key={r.type}
                          type="button"
                          onClick={() => handleReact(post.id, r.type)}
                          className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 border transition-all active:scale-95 ${
                            isChosen
                              ? 'bg-gold-primary/20 border-gold-primary/60 text-gold-primary font-black shadow-sm'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="text-[10px] font-bold">{count}</span>
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => toggleExpand(post.id)}
                    className="flex items-center gap-1.5 text-[11px] text-gold-primary font-bold hover:underline"
                  >
                    {expanded[post.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {expanded[post.id] ? 'Hide comments' : `Comments${comments[post.id] ? ` (${comments[post.id].length})` : ''}`}
                  </button>
                </div>

                {!expanded[post.id] && (commentPreviews[post.id]?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {commentPreviews[post.id].map(c => (
                      <div key={c.id} className="flex gap-2 text-xs">
                        <span className="font-bold text-white">{nameOf(c.author_id)}</span>
                        <span className="text-gray-400">{c.body}</span>
                      </div>
                    ))}
                    {commentPreviews[post.id].length >= 2 && (
                      <button onClick={() => toggleExpand(post.id)} className="text-[11px] text-gold-primary font-bold hover:underline">
                        View all comments
                      </button>
                    )}
                  </div>
                )}

                {expanded[post.id] && (
                  <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                    {commentLoading[post.id] && !comments[post.id] ? (
                      <p className="text-[11px] text-gray-500">Loading comments…</p>
                    ) : (comments[post.id] || []).length === 0 ? (
                      <p className="text-[11px] text-gray-600 italic">No comments yet.</p>
                    ) : (
                      (comments[post.id] || []).map(c => (
                        <div key={c.id} className="flex gap-2 text-xs">
                          <span className="font-bold text-white">{nameOf(c.author_id)}</span>
                          <span className="text-gray-400">{c.body}</span>
                        </div>
                      ))
                    )}
                    <div className="flex gap-2 mt-2">
                      <input
                        value={commentDraft[post.id] || ''}
                        onChange={e => setCommentDraft(prev => ({ ...prev, [post.id]: e.target.value }))}
                        maxLength={1000}
                        placeholder="Add a comment…"
                        onKeyDown={e => { if (e.key === 'Enter') submitComment(post.id) }}
                        className="flex-1 bg-black border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-gold-primary/40"
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        disabled={commentLoading[post.id] || !(commentDraft[post.id] || '').trim()}
                        className="bg-white/5 hover:bg-white/10 text-gold-primary border border-gold-primary/20 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div ref={sentinelRef} className="h-4" />

          {loadingMore && (
            <div className="glass-panel p-4 text-center text-gray-500 flex items-center justify-center gap-2 text-xs">
              <Loader size={14} className="animate-spin" /> Loading more…
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-[10px] text-gray-700 uppercase tracking-widest py-2">You&apos;ve reached the end</p>
          )}
        </div>
      )}

      {/* EVENT RIDE POOLER MODAL */}
      <EventRidePoolerModal
        isOpen={showRidePoolerModal}
        onClose={() => setShowRidePoolerModal(false)}
        upcomingEvents={upcomingGruvsEvents}
      />

      {/* INSTITUTIONAL BROADCASTS & CIRCULARS MODAL */}
      <InstitutionalBroadcastsPortal
        isOpen={showInstitutionalModal}
        onClose={() => setShowInstitutionalModal(false)}
      />

      {/* AUDIO GOSSIP VOICE SCRAMBLER MODAL */}
      <AudioGossipRecorderModal
        isOpen={showAudioGossipModal}
        onClose={() => setShowAudioGossipModal(false)}
      />

      {/* PLATESHARE FOOD HUB MODAL */}
      <PlateShareFoodHubModal
        isOpen={showPlateShareModal}
        onClose={() => setShowPlateShareModal(false)}
      />

      {/* AUDIO SPACES TOWN HALL MODAL */}
      <AudioSpacesTownHallModal
        isOpen={showAudioSpacesModal}
        onClose={() => setShowAudioSpacesModal(false)}
      />

      {/* RESIDENT KARMA & REPUTATION MODAL */}
      <ResidentKarmaModal
        isOpen={showResidentKarmaModal}
        onClose={() => setShowResidentKarmaModal(false)}
      />
    </div>
  )
}
