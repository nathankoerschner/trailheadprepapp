'use client'

import { Strikethrough, Flag, Highlighter } from 'lucide-react'

interface AnnotationToolbarProps {
  eliminateMode: boolean
  onToggleEliminateMode: () => void
  flagged?: boolean
  onToggleFlag?: () => void
  highlightMode?: boolean
  onToggleHighlightMode?: () => void
}

export function AnnotationToolbar({
  eliminateMode,
  onToggleEliminateMode,
  flagged,
  onToggleFlag,
  highlightMode,
  onToggleHighlightMode,
}: AnnotationToolbarProps) {
  return (
    <div className="flex gap-1">
      <button
        onClick={onToggleEliminateMode}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          eliminateMode
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
        }`}
        title="Eliminate answers"
      >
        <Strikethrough className="h-3.5 w-3.5" />
        Eliminate
      </button>
      {onToggleFlag && (
        <button
          onClick={onToggleFlag}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            flagged
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
          title={flagged ? 'Unflag question' : 'Flag for review'}
        >
          <Flag className={`h-3.5 w-3.5 ${flagged ? 'fill-amber-500' : ''}`} />
          {flagged ? 'Flagged' : 'Flag'}
        </button>
      )}
      {onToggleHighlightMode && (
        <button
          onClick={onToggleHighlightMode}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            highlightMode
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
          title={highlightMode ? 'Stop highlighting' : 'Highlight text'}
        >
          <Highlighter className={`h-3.5 w-3.5 ${highlightMode ? 'fill-amber-400' : ''}`} />
          Highlight
        </button>
      )}
    </div>
  )
}
