'use client'

import { useMemo } from 'react'
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
}

export function AnswerGrid({ questions, students, studentAnswers, onQuestionClick }: AnswerGridProps) {
  const answerMap = useMemo(() => {
    const map = new Map<string, GridAnswer>()
    for (const a of studentAnswers) {
      map.set(`${a.student_id}:${a.question_id}`, a)
    }
    return map
  }, [studentAnswers])

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
                <button
                  onClick={() => onQuestionClick(q)}
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Q{q.question_number}
                </button>
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
