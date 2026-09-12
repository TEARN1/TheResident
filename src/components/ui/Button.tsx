'use client'

import React from 'react'
import { Loader } from 'lucide-react'

// Items 127 and 128 of docs/DESIGN-OVERHAUL.md.
//
// GoldButton covered exactly one of the four things a button needs to be: the
// gold-outline CTA. Everything else — a filled primary action, a quiet
// tertiary link-button, a destructive confirm — was hand-typed at each call
// site, which is why "Delete" and "Confirm block" look different on every
// screen that has them.
//
// The loading state is not decoration. Several forms in this app could be
// submitted twice by double-tapping, because the only thing stopping a second
// press was how fast the network came back. `loading` disables the button as
// well as showing a spinner, so the disabled state and the visible state can
// never disagree.

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  // Filled. One per screen, for the thing the screen exists to do.
  primary:
    'bg-accent text-content-on-accent border border-accent hover:opacity-90 active:scale-95',
  // Outlined. The common case.
  secondary:
    'bg-accent/10 text-accent border border-accent/30 hover:bg-accent hover:text-content-on-accent active:scale-95',
  // Text only, for actions that must not compete (Cancel, Skip, Back).
  tertiary:
    'bg-transparent text-content-muted border border-transparent hover:text-content hover:bg-surface-sunken/60',
  // Never filled by default: a destructive action should require reading, not
  // just aiming. It fills on hover so the committed press is unmistakable.
  destructive:
    'bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-content active:scale-95'
}

// Every size clears the 44px minimum tap target from item 55 — that is why
// even `sm` carries min-h-[44px] rather than its visual padding alone.
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 text-xs',
  md: 'min-h-[44px] px-4 text-xs',
  lg: 'min-h-[48px] px-6 text-sm'
}

export function buttonClass(opts: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
} = {}): string {
  const { variant = 'secondary', size = 'md', fullWidth = false } = opts
  return [
    fullWidth ? 'w-full' : '',
    'inline-flex items-center justify-center gap-2',
    'font-black rounded-xl uppercase tracking-widest',
    'transition-all disabled:opacity-50 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size]
  ].filter(Boolean).join(' ')
}

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Disables the button as well as showing a spinner. */
  loading?: boolean
  /** What to say while loading. Falls back to the button's own label. */
  loadingLabel?: string
  type?: 'button' | 'submit' | 'reset'
}

export default function Button({
  variant, size, fullWidth, loading = false, loadingLabel,
  className, children, disabled, type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      // A loading button is a disabled button. Keeping these as one decision
      // is the whole point — the double-submit bug was a button that looked
      // busy and was still pressable.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClass({ variant, size, fullWidth })} ${className || ''}`.trim()}
      {...rest}
    >
      {loading && <Loader size={14} className="animate-spin" aria-hidden="true" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  )
}
