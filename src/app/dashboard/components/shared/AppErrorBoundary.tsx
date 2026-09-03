'use client'

/**
 * AppErrorBoundary — catches a render crash, reports it, and shows the
 * resident something other than a blank screen.
 *
 * This and the global listeners in errorReporting.ts cover different failures
 * and neither substitutes for the other: an error boundary catches what React
 * throws during render, and the window listeners catch everything thrown
 * outside it — event handlers, timers, unhandled promises. Both are installed.
 *
 * A class component because React still offers no hook for this.
 */
import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { reportError } from '../../../../utils/errorReporting'

interface Props {
  children: React.ReactNode
  /** Names the area that broke, so reports group by screen rather than by message. */
  area?: string
}

interface State {
  crashed: boolean
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError('render', error, {
      area: this.props.area,
      // The first few frames are enough to locate a component; the whole
      // stack is mostly framework noise and more text to redact.
      componentStack: info.componentStack?.split('\n').slice(0, 6).join('\n')
    })
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div className="glass-panel p-6 text-center space-y-3">
        <AlertTriangle size={28} className="mx-auto text-yellow-500 opacity-70" />
        <div>
          <p className="text-sm font-black text-white uppercase tracking-widest">
            This part didn&apos;t load
          </p>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-sm mx-auto">
            Something broke on our side, not yours. It has been reported automatically.
            The rest of the app still works.
          </p>
        </div>
        <button
          type="button"
          onClick={() => this.setState({ crashed: false })}
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gold-primary transition-colors"
        >
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    )
  }
}
