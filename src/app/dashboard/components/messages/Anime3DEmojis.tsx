'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playTactileSound } from '../../../../utils/tactileSounds'

export type AnimeEmojiId = 'heart' | 'fire' | 'laugh' | 'hundred' | 'star' | 'rocket' | 'clap' | 'bolt'

export interface AnimeEmojiDef {
  id: AnimeEmojiId
  label: string
  fallback: string
  color: string
  glowColor: string
}

export const ANIME_EMOJIS: AnimeEmojiDef[] = [
  { id: 'heart', label: 'Ruby Heart', fallback: '❤️', color: '#ff2e63', glowColor: 'rgba(255, 46, 99, 0.45)' },
  { id: 'fire', label: 'Super Flame', fallback: '🔥', color: '#ff9900', glowColor: 'rgba(255, 153, 0, 0.45)' },
  { id: 'laugh', label: 'Joy Burst', fallback: '😂', color: '#ffd32a', glowColor: 'rgba(255, 211, 42, 0.45)' },
  { id: 'hundred', label: 'Gold 100', fallback: '💯', color: '#f59e0b', glowColor: 'rgba(245, 158, 11, 0.45)' },
  { id: 'star', label: 'Celestial Star', fallback: '🌟', color: '#38ef7d', glowColor: 'rgba(56, 239, 125, 0.45)' },
  { id: 'rocket', label: 'Mecha Boost', fallback: '🚀', color: '#00d2d3', glowColor: 'rgba(0, 210, 211, 0.45)' },
  { id: 'clap', label: 'Energy Clap', fallback: '👏', color: '#ffb142', glowColor: 'rgba(255, 177, 66, 0.45)' },
  { id: 'bolt', label: 'Thunder Bolt', fallback: '⚡', color: '#fffa65', glowColor: 'rgba(255, 250, 101, 0.5)' },
]

export function AnimeEmojiIcon({ id, size = 22 }: { id: string; size?: number }) {
  switch (id) {
    case 'heart':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_8px_rgba(255,46,99,0.5)]">
          <defs>
            <radialGradient id="heartGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ff758c" />
              <stop offset="40%" stopColor="#ff1352" />
              <stop offset="100%" stopColor="#a3002f" />
            </radialGradient>
            <linearGradient id="heartSparkle" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M24 43.5C24 43.5 4.5 30.5 4.5 17.5C4.5 9.5 11 3.5 18.5 3.5C22.5 3.5 24 6.5 24 6.5C24 6.5 25.5 3.5 29.5 3.5C37 3.5 43.5 9.5 43.5 17.5C43.5 30.5 24 43.5 24 43.5Z"
            fill="url(#heartGrad)"
            stroke="#ff9eb5"
            strokeWidth="1.5"
          />
          {/* 3D anime specular highlight crescent */}
          <path
            d="M12 9C15.5 6.5 19 6.5 21 8C18.5 9.5 15 12.5 13.5 16C12.5 14 11.5 11 12 9Z"
            fill="url(#heartSparkle)"
          />
          {/* Sparkle star */}
          <polygon points="34,10 35.5,14 39.5,15.5 35.5,17 34,21 32.5,17 28.5,15.5 32.5,14" fill="#ffffff" />
        </svg>
      )
    case 'fire':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_8px_rgba(255,153,0,0.55)]">
          <defs>
            <linearGradient id="fireOuter" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ff416c" />
              <stop offset="60%" stopColor="#ff4b1f" />
              <stop offset="100%" stopColor="#ff9068" />
            </linearGradient>
            <linearGradient id="fireCore" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#fff275" />
              <stop offset="100%" stopColor="#ff8c00" />
            </linearGradient>
          </defs>
          <path
            d="M24 3C25 10 33 13 33 21C33 24 31 26 29 27C34 26 39 31 39 36C39 42 33 46 24 46C13 46 7 38 7 28C7 19 15 13 19 9C19 14 23 17 25 18C25 14 24 8 24 3Z"
            fill="url(#fireOuter)"
          />
          <path
            d="M24 20C27 24 29 27 29 32C29 37 26 40 23 41C20 40 16 38 16 32C16 27 20 23 24 20Z"
            fill="url(#fireCore)"
          />
          <circle cx="21" cy="14" r="1.5" fill="#fffb91" />
          <circle cx="34" cy="24" r="1.2" fill="#fffb91" />
        </svg>
      )
    case 'laugh':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_8px_rgba(255,211,42,0.5)]">
          <defs>
            <radialGradient id="faceGrad" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fff275" />
              <stop offset="70%" stopColor="#ffc048" />
              <stop offset="100%" stopColor="#ff9f1a" />
            </radialGradient>
            <linearGradient id="tearGrad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#70a1ff" />
              <stop offset="100%" stopColor="#1e90ff" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="21" fill="url(#faceGrad)" stroke="#ff9f1a" strokeWidth="1.5" />
          {/* Anime laughing closed squint eyes (arcs) */}
          <path d="M12 19C14 15 18 15 20 19" stroke="#3d1e03" strokeWidth="3" strokeLinecap="round" />
          <path d="M28 19C30 15 34 15 36 19" stroke="#3d1e03" strokeWidth="3" strokeLinecap="round" />
          {/* Big open mouth with teeth */}
          <path d="M14 26C14 34 20 39 24 39C28 39 34 34 34 26Z" fill="#7d0016" />
          <path d="M15 26C15 28.5 20 29.5 24 29.5C28 29.5 33 28.5 33 26Z" fill="#ffffff" />
          <path d="M18 35C20 33 28 33 30 35C28 38 20 38 18 35Z" fill="#ff6b81" />
          {/* Cascading 3D anime tears */}
          <path d="M8 20C6 24 5 29 7 32C9 35 12 33 11 29C10.5 27 10 23 8 20Z" fill="url(#tearGrad)" />
          <path d="M40 20C42 24 43 29 41 32C39 35 36 33 37 29C37.5 27 38 23 40 20Z" fill="url(#tearGrad)" />
        </svg>
      )
    case 'hundred':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]">
          <defs>
            <linearGradient id="gold100" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#713f12" />
            </linearGradient>
            <linearGradient id="redSlash" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
          <path d="M10 14L15 10V33H10V14Z" fill="url(#gold100)" stroke="#fef08a" strokeWidth="0.8" />
          <rect x="18" y="10" width="11" height="23" rx="5.5" fill="none" stroke="url(#gold100)" strokeWidth="4.5" />
          <rect x="31" y="10" width="11" height="23" rx="5.5" fill="none" stroke="url(#gold100)" strokeWidth="4.5" />
          {/* Double underline speed slashes */}
          <path d="M6 38L42 38" stroke="url(#redSlash)" strokeWidth="3" strokeLinecap="round" />
          <path d="M10 43L38 43" stroke="url(#redSlash)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )
    case 'star':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_8px_rgba(56,239,125,0.45)]">
          <defs>
            <radialGradient id="starGrad" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#a3e635" />
              <stop offset="80%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#14532d" />
            </radialGradient>
          </defs>
          <path
            d="M24 3L28.5 16.5L42 18L31.5 27L35 41L24 33.5L13 41L16.5 27L6 18L19.5 16.5L24 3Z"
            fill="url(#starGrad)"
            stroke="#facc15"
            strokeWidth="1.2"
          />
          <polygon points="24,9 26,17 34,18 28,23 30,31 24,26.5 18,31 20,23 14,18 22,17" fill="#ffffff" opacity="0.65" />
        </svg>
      )
    case 'rocket':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_8px_rgba(0,210,211,0.5)]">
          <defs>
            <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="rocketThrust" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#00d2d3" />
              <stop offset="100%" stopColor="#ff4757" />
            </linearGradient>
          </defs>
          {/* Main rocket fuselage */}
          <path d="M38 10C38 10 37 24 26 31L17 22C24 11 38 10 38 10Z" fill="url(#rocketBody)" stroke="#0284c7" strokeWidth="1.5" />
          {/* Nose cone tip */}
          <path d="M38 10C35 12 32 15 32 15L33 16C33 16 36 13 38 10Z" fill="#ef4444" />
          {/* Porthole */}
          <circle cx="28" cy="20" r="3.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.2" />
          {/* Wings */}
          <path d="M22 27L12 32L16 22L22 27Z" fill="#ef4444" />
          <path d="M26 23L31 33L21 29L26 23Z" fill="#ef4444" />
          {/* Dual plasma thrust flames */}
          <path d="M17 26L7 39C11 36 14 36 15 37L17 26Z" fill="url(#rocketThrust)" />
        </svg>
      )
    case 'clap':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_8px_rgba(255,177,66,0.5)]">
          <defs>
            <linearGradient id="clapHand" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fffa65" />
              <stop offset="50%" stopColor="#ffaf40" />
              <stop offset="100%" stopColor="#ff793f" />
            </linearGradient>
          </defs>
          <path
            d="M18 10C16 10 15 12 16 14L19 19L11 16C9 15 7 17 8 19L18 27L9 24C7 23 6 25 7 27L18 35L15 42L28 42L35 30C36 28 35 25 33 24L26 21L23 13C22 11 20 10 18 10Z"
            fill="url(#clapHand)"
            stroke="#ff9f1a"
            strokeWidth="1.2"
          />
          {/* Impact sparks */}
          <circle cx="12" cy="8" r="1.5" fill="#fffa65" />
          <circle cx="27" cy="6" r="2" fill="#fffa65" />
          <circle cx="36" cy="14" r="1.5" fill="#fffa65" />
        </svg>
      )
    case 'bolt':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0 drop-shadow-[0_2px_10px_rgba(255,250,101,0.65)]">
          <defs>
            <linearGradient id="boltGrad" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#fef08a" />
              <stop offset="80%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          <path
            d="M27 3L8 25H22L17 45L40 21H25L27 3Z"
            fill="url(#boltGrad)"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
        </svg>
      )
    default:
      return <span style={{ fontSize: size * 0.8 }}>{id}</span>
  }
}

interface ReactionPickerProps {
  onSelectEmoji: (id: AnimeEmojiId) => void
  onClose: () => void
  align?: 'left' | 'right'
}

export function AnimeReactionPicker({ onSelectEmoji, onClose, align = 'right' }: ReactionPickerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 6 }}
      transition={{ type: 'spring', damping: 20, stiffness: 350 }}
      className={`absolute z-30 bottom-full mb-2 ${
        align === 'right' ? 'right-0' : 'left-0'
      } flex items-center gap-1.5 p-1.5 sm:p-2 rounded-2xl sm:rounded-full bg-black/90 backdrop-blur-2xl border border-gold-primary/40 shadow-[0_10px_35px_rgba(0,0,0,0.85)] ring-1 ring-white/10`}
      onClick={e => e.stopPropagation()}
    >
      {ANIME_EMOJIS.map(emoji => (
        <button
          key={emoji.id}
          type="button"
          onClick={() => {
            playTactileSound('pop')
            onSelectEmoji(emoji.id)
            onClose()
          }}
          className="relative group p-1.5 sm:p-2 rounded-full hover:bg-white/15 active:scale-125 hover:scale-115 transition-all duration-150 flex items-center justify-center"
          title={emoji.label}
          aria-label={`React with ${emoji.label}`}
        >
          <AnimeEmojiIcon id={emoji.id} size={24} />
          {/* Anime Glow indicator on hover */}
          <span
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-sm pointer-events-none transition-opacity -z-10"
            style={{ backgroundColor: emoji.glowColor }}
          />
        </button>
      ))}
    </motion.div>
  )
}

interface ReactionBadgeProps {
  reactions: Record<string, string[]> // emojiId -> array of userIds
  currentUserId?: string
  onToggleReaction: (emojiId: AnimeEmojiId) => void
}

export function AnimeReactionBadges({ reactions, currentUserId, onToggleReaction }: ReactionBadgeProps) {
  const entries = Object.entries(reactions).filter(([, users]) => users && users.length > 0)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {entries.map(([emojiId, users]) => {
        const hasReacted = currentUserId ? users.includes(currentUserId) : false
        const emojiDef = ANIME_EMOJIS.find(e => e.id === emojiId) || {
          id: emojiId as AnimeEmojiId,
          label: emojiId,
          color: '#ffffff',
          glowColor: 'rgba(255,255,255,0.2)'
        }
        return (
          <button
            key={emojiId}
            type="button"
            onClick={() => {
              playTactileSound('pop')
              onToggleReaction(emojiId as AnimeEmojiId)
            }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black transition-all active:scale-95 ${
              hasReacted
                ? 'bg-gold-primary/20 border border-gold-primary text-gold-primary shadow-[0_0_10px_rgba(255,215,0,0.25)]'
                : 'bg-black/40 hover:bg-white/10 border border-white/10 text-gray-200'
            }`}
            title={`${users.length} reaction${users.length === 1 ? '' : 's'} (${emojiDef.label})`}
          >
            <AnimeEmojiIcon id={emojiId} size={15} />
            <span className="font-mono text-[10px]">{users.length}</span>
          </button>
        )
      })}
    </div>
  )
}
