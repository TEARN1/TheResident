'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { MessageSquare, Send, ChevronDown, ChevronUp, Video, Loader, Image as ImageIcon, X, Palette, Trash2 } from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import { humanizeSupabaseError } from '../../../utils/humanizeError'
import BlockUserButton from '../components/BlockUserButton'
import EmptyState from '../components/EmptyState'

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

  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, GossipComment[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({})

  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)

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
    setLoading(false)
  }, [fetchProfilesFor])

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
    loadingMoreRef.current = false
    setLoadingMore(false)
  }, [posts, fetchProfilesFor])

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

    const { error: insertError } = await supabase
      .from('res_gossip_posts')
      .insert({
        author_id: myId,
        community_id: null,
        body: composerBody.trim(),
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
    clearMedia()
    setSelectedBackground(null)
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
    setComments(prev => ({ ...prev, [postId]: (data || []) as GossipComment[] }))
    setCommentLoading(prev => ({ ...prev, [postId]: false }))
  }

  return (
    <div className="space-y-6">
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
        <textarea
          value={composerBody}
          onChange={e => setComposerBody(e.target.value)}
          maxLength={2000}
          placeholder="Spotted something? Heard something? Say it here…"
          className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/50 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.08)] transition-all relative"
        />
        {composerBody.length > 0 && (
          <p className="text-[10px] text-gray-600 text-right mt-1">{composerBody.length}/2000</p>
        )}

        {mediaPreview && (
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

        {!mediaFile && (
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

        {mediaError && <p className="text-[11px] text-red-400 mt-2">{mediaError}</p>}

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
            onClick={submitPost}
            disabled={posting || uploading || (!composerBody.trim() && !mediaFile)}
            className="flex items-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-gold-primary/10 hover:shadow-gold-primary/25"
          >
            {uploading ? <Loader size={13} className="animate-spin" /> : <Send size={13} />}
            {uploading ? 'Uploading…' : posting ? 'Posting…' : 'Post'}
          </button>
        </div>
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
          {posts.map(post => {
            const bgCss = !post.media_url ? backgroundCssFor(post.background_style) : null
            if (bgCss) {
              return (
                <div key={post.id} className="glass-panel overflow-hidden">
                  <div
                    className="p-8 relative flex items-center justify-center min-h-[180px]"
                    style={{ backgroundImage: bgCss }}
                  >
                    <div className="absolute top-3 right-3">
                      {post.author_id === myId
                        ? <button onClick={() => deletePost(post.id)} aria-label="Delete post" title="Delete post" className="bg-black/50 hover:bg-red-500/80 text-white/80 hover:text-white rounded-full p-1.5 transition-all"><Trash2 size={13} /></button>
                        : <BlockUserButton targetUserId={post.author_id} currentUserId={myId} />}
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-white text-center leading-snug whitespace-pre-wrap drop-shadow-md max-w-md">
                      {post.body}
                    </p>
                    <div className="absolute bottom-3 left-4 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-white/90">{nameOf(post.author_id)}</span>
                      <span className="text-[10px] text-white/60">{new Date(post.created_at).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => toggleExpand(post.id)}
                      className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[11px] text-white/90 font-bold hover:underline"
                    >
                      {expanded[post.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {expanded[post.id] ? 'Hide' : `Comments${comments[post.id] ? ` (${comments[post.id].length})` : ''}`}
                    </button>
                  </div>

                  {expanded[post.id] && (
                    <div className="p-5 space-y-3 border-t border-white/5">
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
            }

            return (
              <div key={post.id} className="glass-panel p-5 transition-all hover:border-gold-primary/15">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gold-primary/10 ring-1 ring-gold-primary/20 flex items-center justify-center text-gold-primary text-xs font-black overflow-hidden">
                      {profileMap[post.author_id]?.avatar_url
                        ? <img src={profileMap[post.author_id].avatar_url as string} alt="" className="w-full h-full object-cover" />
                        : nameOf(post.author_id).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{nameOf(post.author_id)}</p>
                      <p className="text-[10px] text-gray-600">{new Date(post.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {post.author_id === myId
                    ? <button onClick={() => deletePost(post.id)} aria-label="Delete post" title="Delete post" className="text-gray-600 hover:text-red-400 transition-all p-1"><Trash2 size={15} /></button>
                    : <BlockUserButton targetUserId={post.author_id} currentUserId={myId} />}
                </div>
                {post.body && <p className="text-sm text-gray-300 mt-3 leading-relaxed whitespace-pre-wrap">{post.body}</p>}

                {post.media_url && post.media_type === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.media_url} alt="" className="mt-3 w-full max-h-96 object-contain rounded-lg border border-white/5" />
                )}
                {post.media_url && post.media_type === 'video' && (
                  <video src={post.media_url} controls className="mt-3 w-full max-h-96 rounded-lg border border-white/5" />
                )}

                <button
                  onClick={() => toggleExpand(post.id)}
                  className="flex items-center gap-1.5 text-[11px] text-gold-primary font-bold mt-4 hover:underline"
                >
                  {expanded[post.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {expanded[post.id] ? 'Hide comments' : `Comments${comments[post.id] ? ` (${comments[post.id].length})` : ''}`}
                </button>

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
    </div>
  )
}
