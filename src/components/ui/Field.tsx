'use client'

import React, { useId, useState } from 'react'
import { AlertCircle } from 'lucide-react'

// Items 129 and 130. Inputs in this app vary in height, focus treatment and
// error handling from screen to screen, and validation almost always fires
// only on submit — so a resident fills in six fields, presses the button, and
// is then told the second one was wrong.
//
// `validate` runs on blur and again on every change ONCE the field has been
// blurred. Validating as someone types the first character tells them their
// email is invalid when they have typed "a", which is true and useless.

export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  hint?: string
  /** Return an error message, or null when the value is acceptable. */
  validate?: (value: string) => string | null
  onChange?: (value: string) => void
  /** An error decided elsewhere (usually by the server) always wins. */
  error?: string | null
}

export default function Field({
  label, hint, validate, onChange, error: externalError,
  className, id, ...rest
}: FieldProps) {
  const generatedId = useId()
  const fieldId = id || generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  const [touched, setTouched] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const error = externalError ?? localError
  const invalid = !!error

  const check = (value: string) => {
    if (!validate) return
    setLocalError(validate(value))
  }

  return (
    <div className={className}>
      {/* Always a real <label>, never a placeholder standing in for one:
          a placeholder disappears the moment someone starts typing, which is
          exactly when they need to know what the field was. WCAG 3.3.2. */}
      <label htmlFor={fieldId} className="block text-xs font-bold text-content mb-1.5">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={invalid || undefined}
        aria-describedby={[hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(' ') || undefined}
        onBlur={e => { setTouched(true); check(e.target.value) }}
        onChange={e => {
          onChange?.(e.target.value)
          // Re-check only after the first blur, so the message appears when
          // they have finished, and then updates live as they fix it.
          if (touched) check(e.target.value)
        }}
        className={`w-full min-h-[44px] px-3 rounded-xl bg-surface-sunken/40 text-sm text-content
          border ${invalid ? 'border-danger' : 'border-default'}
          placeholder:text-content-subtle transition-colors`}
        {...rest}
      />
      {hint && !invalid && (
        <p id={hintId} className="text-[11px] text-content-subtle mt-1.5">{hint}</p>
      )}
      {invalid && (
        // Icon as well as colour — item 38.
        <p id={errorId} role="alert" className="text-[11px] text-danger mt-1.5 flex items-center gap-1">
          <AlertCircle size={11} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  )
}
