'use client'

import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface KaTeXRendererProps {
  math: string
  display?: boolean
  className?: string
}

export function KaTeXRenderer({ math, display = false, className }: KaTeXRendererProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(math, ref.current, {
          displayMode: display,
          throwOnError: false,
          trust: true,
        })
      } catch {
        if (ref.current) {
          ref.current.textContent = math
        }
      }
    }
  }, [math, display])

  return <span ref={ref} className={className} />
}

// Render text that may contain inline LaTeX delimited by $...$, $$...$$, \(...\), or \[...\]
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <KaTeXRenderer key={i} math={part.slice(2, -2)} display />
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          return <KaTeXRenderer key={i} math={part.slice(1, -1)} />
        }
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          return <KaTeXRenderer key={i} math={part.slice(2, -2)} />
        }
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          return <KaTeXRenderer key={i} math={part.slice(2, -2)} display />
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
