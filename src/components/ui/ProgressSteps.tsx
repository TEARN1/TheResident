'use client'

import React from 'react'
import { Check } from 'lucide-react'

// Item 147, generalised.
//
// A single badge says where you are and nothing about where that sits in a
// sequence. "Under Review" gives a landlord no sense that there IS a next
// stage, how many there are, or what ends the wait — so it reads as a state
// the account is stuck in rather than a step in a process.
//
// Deliberately no timeframes anywhere. The verification queue has no
// guaranteed turnaround, and a sequence that implies one would be the same
// promise the reports queue used to make ("it will be reviewed") with nobody
// behind it.

export interface Step {
  id: string
  label: string
  /** What the resident does here, when it is their move. */
  hint?: string
}

export default function ProgressSteps({
  steps, currentIndex, tone = 'accent', label
}: {
  steps: Step[]
  /** -1 means nothing started yet. */
  currentIndex: number
  tone?: 'accent' | 'warning'
  /** Names the sequence for screen readers. */
  label: string
}) {
  const active = tone === 'warning' ? 'bg-warning text-content-on-accent' : 'bg-accent text-content-on-accent'

  return (
    <ol aria-label={label} className="flex items-start gap-1">
      {steps.map((step, i) => {
        const done = i < currentIndex
        const current = i === currentIndex
        return (
          <li key={step.id} className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span
                // Number, tick, or hollow — never colour alone (item 38). A
                // colour-blind landlord still sees which stage is which.
                aria-hidden="true"
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0
                  ${done ? 'bg-success text-content-on-accent' : current ? active : 'bg-surface-sunken text-content-subtle border border-subtle'}`}
              >
                {done ? <Check size={11} /> : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`h-0.5 flex-1 rounded-full ${i < currentIndex ? 'bg-success' : 'bg-surface-sunken'}`}
                />
              )}
            </div>
            <p className={`text-[10px] mt-1.5 leading-tight break-words
              ${current ? 'text-content font-black' : 'text-content-subtle'}`}>
              {step.label}
              {current && <span className="sr-only"> — current step</span>}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
