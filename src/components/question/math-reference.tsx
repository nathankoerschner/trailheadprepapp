'use client'

import { useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import { KaTeXRenderer, MathText } from '@/components/math/katex-renderer'

const FORMULAS = [
  // Area formulas
  { label: 'Circle', formula: 'A = \\pi r^2,\\quad C = 2\\pi r' },
  { label: 'Rectangle', formula: 'A = \\ell w' },
  { label: 'Triangle', formula: 'A = \\frac{1}{2}bh' },
  { label: 'Pythagorean', formula: 'c^2 = a^2 + b^2' },
  // Special right triangles
  { label: '30-60-90', formula: 'x,\\; x\\sqrt{3},\\; 2x' },
  { label: '45-45-90', formula: 's,\\; s,\\; s\\sqrt{2}' },
  // Volume formulas
  { label: 'Box', formula: 'V = \\ell wh' },
  { label: 'Cylinder', formula: 'V = \\pi r^2 h' },
  { label: 'Sphere', formula: 'V = \\frac{4}{3}\\pi r^3' },
  { label: 'Cone', formula: 'V = \\frac{1}{3}\\pi r^2 h' },
  { label: 'Pyramid', formula: 'V = \\frac{1}{3}\\ell wh' },
]

const FACTS = [
  'The number of degrees of arc in a circle is 360.',
  'The number of radians of arc in a circle is $2\\pi$.',
  'The sum of the measures in degrees of the angles of a triangle is 180.',
]

export function MathReference() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Toggle button — fixed bottom-left */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-md transition-colors hover:bg-slate-50"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Reference
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-14 left-4 z-40 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-2">
            <span className="text-sm font-semibold text-slate-900">Reference</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Formulas table */}
            <div className="space-y-2">
              {FORMULAS.map(({ label, formula }) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[11px] font-medium text-slate-400 w-16">{label}</span>
                  <KaTeXRenderer math={formula} className="text-sm" />
                </div>
              ))}
            </div>

            {/* Divider */}
            <hr className="border-slate-100" />

            {/* Facts */}
            <ul className="space-y-1 text-xs text-slate-600">
              {FACTS.map((fact, i) => (
                <li key={i}>
                  <MathText text={fact} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
