'use client'

import { useCallback, useState, useRef } from 'react'
import { KaTeXRenderer } from '@/components/math/katex-renderer'
import { AnnotationPopover } from '@/components/question/annotation-popover'
import type { Highlight } from '@/lib/hooks/use-highlights'

// Same regex as MathText to split on KaTeX delimiters
const MATH_REGEX = /(\$\$[\s\S]*?\$\$|\$[^$]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g

interface HighlightableMathTextProps {
  text: string
  highlights: Highlight[]
  highlightMode: boolean
  onAddHighlight: (start: number, end: number) => string | undefined
  onRemoveHighlight: (id: string) => void
  onUpdateNote: (id: string, note: string) => void
}

/** Render a plain-text segment with highlight <mark> spans applied */
function renderPlainSegment(
  plainText: string,
  segmentOffset: number,
  highlights: Highlight[],
  onClickHighlight: (hl: Highlight, e: React.MouseEvent) => void,
) {
  // Find highlights that overlap this segment
  const segEnd = segmentOffset + plainText.length
  const relevant = highlights
    .filter((h) => h.start < segEnd && h.end > segmentOffset)
    .sort((a, b) => a.start - b.start)

  if (relevant.length === 0) {
    return <>{plainText}</>
  }

  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const hl of relevant) {
    // Map highlight offsets to local segment indices
    const localStart = Math.max(0, hl.start - segmentOffset)
    const localEnd = Math.min(plainText.length, hl.end - segmentOffset)

    // Text before this highlight
    if (localStart > cursor) {
      parts.push(<span key={`t-${cursor}`}>{plainText.slice(cursor, localStart)}</span>)
    }

    // Highlighted text
    parts.push(
      <mark
        key={hl.id}
        className="cursor-pointer rounded-sm bg-amber-200/70 px-0.5 transition-colors hover:bg-amber-300/80"
        onClick={(e) => {
          e.stopPropagation()
          onClickHighlight(hl, e)
        }}
        title={hl.note || 'Click to view/edit note'}
      >
        {plainText.slice(localStart, localEnd)}
      </mark>
    )

    cursor = localEnd
  }

  // Remaining text after last highlight
  if (cursor < plainText.length) {
    parts.push(<span key={`t-${cursor}`}>{plainText.slice(cursor)}</span>)
  }

  return <>{parts}</>
}

export function HighlightableMathText({
  text,
  highlights,
  highlightMode,
  onAddHighlight,
  onRemoveHighlight,
  onUpdateNote,
}: HighlightableMathTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [popover, setPopover] = useState<{
    highlight: Highlight
    x: number
    y: number
  } | null>(null)

  const handleClickHighlight = useCallback((hl: Highlight, e: React.MouseEvent) => {
    setPopover({
      highlight: hl,
      x: e.clientX,
      y: e.clientY,
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    if (!highlightMode) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !containerRef.current) return

    const range = selection.getRangeAt(0)
    if (!containerRef.current.contains(range.commonAncestorContainer)) return

    // Walk through text nodes to compute character offset in the raw string
    const startOffset = getTextOffset(containerRef.current, range.startContainer, range.startOffset)
    const endOffset = getTextOffset(containerRef.current, range.endContainer, range.endOffset)

    if (startOffset === null || endOffset === null || startOffset === endOffset) return

    const start = Math.min(startOffset, endOffset)
    const end = Math.max(startOffset, endOffset)

    // Clear the selection
    selection.removeAllRanges()

    // Create highlight immediately on selection
    onAddHighlight(start, end)
  }, [highlightMode, onAddHighlight])

  const handleSave = useCallback((note: string) => {
    if (!popover?.highlight) return
    onUpdateNote(popover.highlight.id, note)
    setPopover(null)
  }, [popover, onUpdateNote])

  const handleDelete = useCallback(() => {
    if (popover?.highlight) {
      onRemoveHighlight(popover.highlight.id)
    }
    setPopover(null)
  }, [popover, onRemoveHighlight])

  // Split text into parts (same as MathText)
  const parts = text.split(MATH_REGEX)

  // Track character offset as we walk through parts
  let charOffset = 0

  return (
    <>
      <span
        ref={containerRef}
        className={highlightMode ? 'cursor-text select-text' : ''}
        style={{ whiteSpace: 'pre-wrap' }}
        onMouseUp={handleMouseUp}
      >
        {parts.map((part, i) => {
          const partStart = charOffset
          charOffset += part.length

          // KaTeX display math $$...$$
          if (part.startsWith('$$') && part.endsWith('$$')) {
            return <KaTeXRenderer key={i} math={part.slice(2, -2)} display />
          }
          // KaTeX inline math $...$
          if (part.startsWith('$') && part.endsWith('$')) {
            return <KaTeXRenderer key={i} math={part.slice(1, -1)} />
          }
          // \(...\)
          if (part.startsWith('\\(') && part.endsWith('\\)')) {
            return <KaTeXRenderer key={i} math={part.slice(2, -2)} />
          }
          // \[...\]
          if (part.startsWith('\\[') && part.endsWith('\\]')) {
            return <KaTeXRenderer key={i} math={part.slice(2, -2)} display />
          }

          // Plain text — render with highlights
          return (
            <span key={i} data-offset={partStart}>
              {renderPlainSegment(part, partStart, highlights, handleClickHighlight)}
            </span>
          )
        })}
      </span>

      {popover && (
        <AnnotationPopover
          x={popover.x}
          y={popover.y}
          note={popover.highlight?.note ?? ''}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  )
}

/**
 * Walk DOM tree under root to compute the character offset in the raw text
 * for a given DOM node + offset (from Selection API).
 * Only counts text in elements with data-offset attributes (plain text spans)
 * and maps back to the raw string offset.
 */
function getTextOffset(
  root: Node,
  targetNode: Node,
  targetOffset: number,
): number | null {
  // Find the nearest span with data-offset
  let container = targetNode
  while (container && container !== root) {
    if (
      container instanceof HTMLElement &&
      container.hasAttribute('data-offset')
    ) {
      break
    }
    container = container.parentNode!
  }

  if (!container || container === root || !(container instanceof HTMLElement)) {
    return null
  }

  const segmentOffset = parseInt(container.getAttribute('data-offset')!, 10)

  // Count text characters before targetNode within this segment
  let counted = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node: Node | null

  while ((node = walker.nextNode())) {
    if (node === targetNode) {
      return segmentOffset + counted + targetOffset
    }
    counted += (node.textContent?.length ?? 0)
  }

  // If targetNode is the container itself (e.g., selecting at element boundary)
  return segmentOffset + targetOffset
}
