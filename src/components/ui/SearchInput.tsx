'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

// Item 138. Search boxes on the directory, housing and trust-circle screens
// each debounce differently (or not at all — the trust-circle one queries on
// every keystroke), and none of them has a clear button, so emptying the box
// on a phone means holding backspace.

export default function SearchInput({
  value, onChange, placeholder = 'Search…', debounceMs = 250, label, className
}: {
  value: string
  /** Called with the debounced value, not every keystroke. */
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  /** Names the input for screen readers; rendered visually hidden. */
  label: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  // The callback is held in a ref so that a parent passing a fresh arrow
  // function on every render does not restart the debounce timer forever.
  // Assigned in an effect, not during render — a ref written during render is
  // a value React is allowed to discard.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Keep in step when the parent resets the query (a cleared filter, a route
  // change) without firing the debounced callback back at it.
  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    if (draft === value) return
    const t = setTimeout(() => onChangeRef.current(draft), debounceMs)
    return () => clearTimeout(t)
  }, [draft, value, debounceMs])

  return (
    <div className={`relative ${className || ''}`.trim()}>
      <Search
        size={14}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle pointer-events-none"
      />
      <input
        type="search"
        aria-label={label}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[44px] pl-9 pr-11 rounded-xl bg-surface-sunken/40 text-sm text-content
          border border-default placeholder:text-content-subtle"
      />
      {draft && (
        <button
          type="button"
          // Clearing is immediate: waiting 250ms to empty a box someone just
          // asked to empty feels like the button did not work.
          onClick={() => { setDraft(''); onChangeRef.current('') }}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-[44px] h-[44px] flex items-center justify-center text-content-subtle hover:text-content"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
