'use client'

import React, { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import type { GridQuestion, GridAnswer } from '@/lib/types/database'

interface AnswerGridProps {
  questions: GridQuestion[]
  students: Array<{
    student_id: string
    test_submitted: boolean
    students: { name: string }
  }>
  studentAnswers: GridAnswer[]
  onQuestionClick: (question: GridQuestion) => void
  onCounterpartClick?: (question: GridQuestion) => void
  counterpartLoadingId?: string | null
}

export function AnswerGrid({ questions, students, studentAnswers, onQuestionClick, onCounterpartClick, counterpartLoadingId }: AnswerGridProps) {
  const answerMap = useMemo(() => {
    const map = new Map<string, GridAnswer>()
    for (const a of studentAnswers) {
      map.set(`${a.student_id}:${a.question_id}`, a)
    }
    return map
  }, [studentAnswers])

  const correctRatioMap = useMemo(() => {
    const map = new Map<string, number>()
    const submittedStudents = students.filter((s) => s.test_submitted)
    if (submittedStudents.length === 0) return map
    for (const q of questions) {
      let correct = 0
      let answered = 0
      for (const s of submittedStudents) {
        const a = answerMap.get(`${s.student_id}:${q.id}`)
        if (a?.selected_answer) {
          answered++
          if (a.is_correct) correct++
        }
      }
      map.set(q.id, answered > 0 ? correct / answered : -1)
    }
    return map
  }, [questions, students, answerMap])

  if (questions.length === 0 || students.length === 0) {
    return <p className="text-center text-slate-500 py-8">No data available</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-500">
              Q#
            </th>
            {students.map((s) => (
              <th
                key={s.student_id}
                className="border-b border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-500 whitespace-nowrap"
              >
                {s.students.name.split(' ')[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} className="hover:bg-slate-50/50">
              <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-3 py-1.5">
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => onQuestionClick(q)}
                    className="rounded px-1.5 py-0.5 text-xs font-medium transition-colors"
                    style={ratioToStyle(correctRatioMap.get(q.id))}
                  >
                    Q{q.question_number}
                  </button>
                  {onCounterpartClick && (
                    <button
                      onClick={() => onCounterpartClick(q)}
                      disabled={counterpartLoadingId === q.id}
                      className="rounded p-0.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50"
                      title="AI counterpart question"
                    >
                      <Sparkles className={`h-3 w-3 ${counterpartLoadingId === q.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </td>
              {students.map((s) => {
                const answer = answerMap.get(`${s.student_id}:${q.id}`)
                return (
                  <td
                    key={s.student_id}
                    className="border-b border-slate-200 px-2 py-1.5 text-center"
                  >
                    <AnswerCell answer={answer} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ratioToStyle(ratio: number | undefined): React.CSSProperties {
  if (ratio === undefined || ratio < 0) return { color: '#334155' }
  // Interpolate from red (0%) through yellow (50%) to green (100%)
  const r = ratio <= 0.5 ? 220 : Math.round(220 - (ratio - 0.5) * 2 * 180)
  const g = ratio <= 0.5 ? Math.round(60 + ratio * 2 * 140) : 200
  const b = ratio <= 0.5 ? 60 : Math.round(60 + (ratio - 0.5) * 2 * 40)
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.18)`,
    color: `rgb(${Math.round(r * 0.6)}, ${Math.round(g * 0.45)}, ${Math.round(b * 0.4)})`,
  }
}

function AnswerCell({ answer }: { answer: GridAnswer | undefined }) {
  if (!answer || !answer.selected_answer) {
    return <span className="text-slate-300">—</span>
  }

  if (answer.is_correct) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold bg-green-100 text-green-700">
        {answer.selected_answer}
      </span>
    )
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold bg-red-100 text-red-700">
      {answer.selected_answer}
    </span>
  )
}
