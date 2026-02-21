'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Trash2 } from 'lucide-react'

interface AnnotationPopoverProps {
  /** Screen x/y where the popover should appear */
  x: number
  y: number
  /** Existing note (empty string for new highlights) */
  note: string
  onSave: (note: string) => void
  onDelete?: () => void
  onClose: () => void
}

export function AnnotationPopover({
  x,
  y,
  note,
  onSave,
  onDelete,
  onClose,
}: AnnotationPopoverProps) {
  const [text, setText] = useState(note)
  const ref = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Position: keep within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y + 8, window.innerHeight - 200),
    zIndex: 100,
  }

  return (
    <div ref={ref} style={style} className="w-60 rounded-lg border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="text-xs font-medium text-slate-600">
          {note ? 'Edit Note' : 'Add Note'}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note (optional)..."
          rows={3}
          className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-amber-300 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          {onDelete ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={() => onSave(text)}
            className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
