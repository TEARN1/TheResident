'use client'

import React from 'react'

// `glass-panel` (globals.css) is already the de-facto card primitive — used
// on 27+ dashboard screens — but every call site re-decides its own padding
// and spacing by hand. This just names that pattern and gives it one place
// to standardize padding, rather than introducing a new visual language.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8'
}

export default function Card({ padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div className={`glass-panel ${PADDING[padding]} ${className || ''}`.trim()} {...rest}>
      {children}
    </div>
  )
}
