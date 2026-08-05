'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { MessageSquare, Send, ChevronDown, ChevronUp, Video, Loader } from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import BlockUserButton from '../components/BlockUserButton'

interface GossipPost {
  id: string
  author_id: string
  community_id: string | null
  body: string
  hidden: boolean
  created_at: string
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

export default function GossipPage() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const myId = currentUser?.id

  const [posts, setPosts] = useState<GossipPost[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, ProfileHit>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [composerBody, setComposerBody] = useState('')
  const [posting, setPosting] = useState(false)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, GossipComment[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({})

  const loadPosts = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: postsError } = await supabase
      .from('res_gossip_posts')
      .select('id, author_id, community_id, body, hidden, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (postsError) {
      setError(postsError.message)
      setLoading(false)
      return
    }
    const rows = (data || []) as GossipPost[]
    setPosts(rows)

    const authorIds = [...new Set(rows.map(p => p.author_id))]
    if (authorIds.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds)
      const map: Record<string, ProfileHit> = {}
      for (const p of people || []) map[String(p.id)] = p as ProfileHit
      setProfileMap(prev => ({ ...prev, ...map }))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPosts()
  }, [loadPosts])

  const nameOf = (id: string) => {
    const p = profileMap[id]
    return p?.display_name || p?.username || 'Resident'
  }

  const submitPost = async () => {
    if (!supabase || !composerBody.trim()) return
    setPosting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('res_post_gossip', { p_community: null, p_body: composerBody.trim() })
    setPosting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setComposerBody('')
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

      const authorIds = [...new Set(rows.map(c => c.author_id))].filter(id => !profileMap[id])
      if (authorIds.length > 0) {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', authorIds)
        const map: Record<string, ProfileHit> = {}
        for (const p of people || []) map[String(p.id)] = p as ProfileHit
        setProfileMap(prev => ({ ...prev, ...map }))
      }
      setCommentLoading(prev => ({ ...prev, [postId]: false }))
    }
  }

  const submitComment = async (postId: string) => {
    const body = (commentDraft[postId] || '').trim()
    if (!supabase || !body) return
    setCommentLoading(prev => ({ ...prev, [postId]: true }))
    const { error: rpcError } = await supabase.rpc('res_comment_gossip', { p_post: postId, p_body: body })
    if (rpcError) {
      setError(rpcError.message)
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
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={20} className="text-gold-primary" />
          <h2 className="text-xl font-bold text-white">Gossip Feed</h2>
        </div>
        <textarea
          value={composerBody}
          onChange={e => setComposerBody(e.target.value)}
          maxLength={2000}
          placeholder="What's happening in the neighbourhood?"
          className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/40"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-gray-600 flex items-center gap-1.5">
            <Video size={12} /> Got a video? Share it on The Gruvs instead — text only here.
          </p>
          <button
            onClick={submitPost}
            disabled={posting || !composerBody.trim()}
            className="flex items-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2 px-5 rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-50"
          >
            <Send size={13} /> {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
      </div>

      {loading ? (
        <div className="glass-panel p-12 text-center text-gray-500 flex items-center justify-center gap-2">
          <Loader size={16} className="animate-spin" /> Loading feed…
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-panel p-12 text-center text-gray-500">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-10" />
          <p>Nothing posted yet. Be the first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} className="glass-panel p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gold-primary/10 flex items-center justify-center text-gold-primary text-xs font-black overflow-hidden">
                    {profileMap[post.author_id]?.avatar_url
                      ? <img src={profileMap[post.author_id].avatar_url as string} alt="" className="w-full h-full object-cover" />
                      : nameOf(post.author_id).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{nameOf(post.author_id)}</p>
                    <p className="text-[10px] text-gray-600">{new Date(post.created_at).toLocaleString()}</p>
                  </div>
                </div>
                {post.author_id !== myId && <BlockUserButton targetUserId={post.author_id} currentUserId={myId} />}
              </div>
              <p className="text-sm text-gray-300 mt-3 leading-relaxed whitespace-pre-wrap">{post.body}</p>

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
          ))}
        </div>
      )}
    </div>
  )
}
