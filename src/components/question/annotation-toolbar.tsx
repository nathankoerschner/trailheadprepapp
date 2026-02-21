'use client'

import { Strikethrough } from 'lucide-react'

interface AnnotationToolbarProps {
  eliminateMode: boolean
  onToggleEliminateMode: () => void
}

export function AnnotationToolbar({
  eliminateMode,
  onToggleEliminateMode,
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
    </div>
  )
}
