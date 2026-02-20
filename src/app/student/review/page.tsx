'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { studentFetch } from '@/lib/utils/student-api'
import { toast } from 'sonner'
import { getStudentStorageItem, clearStudentStorage } from '@/lib/utils/student-storage'
import type { AnswerChoice } from '@/lib/types/database'

interface ReviewQuestion {
  id: string
  question_number: number
  image_url: string | null
  question_text: string | null
  answer_a: string | null
  answer_b: string | null
  answer_c: string | null
  answer_d: string | null
  correct_answer: AnswerChoice
  section: string
  has_graphic: boolean
  graphic_url: string | null
  answers_are_visual: boolean
  selectedAnswer: AnswerChoice | null
  isCorrect: boolean | null
}

export default function StudentReviewPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect'>('all')

  useEffect(() => {
    loadReviewData()
  }, [])

  async function loadReviewData() {
    const sessionId = getStudentStorageItem('session_id')
    if (!sessionId) {
      router.push('/student/join')
      return
    }

    const res = await studentFetch('/api/test/review')
    if (!res.ok) {
      toast.error('Failed to load review')
      router.push('/student/join')
      return
    }

    const data: ReviewQuestion[] = await res.json()
    setQuestions(data)
    setLoading(false)
  }

  if (loading) return <p className="text-center text-slate-500 py-12">Loading review...</p>
  if (questions.length === 0) return <p className="text-center text-slate-500 py-12">No questions found</p>

  const correctCount = questions.filter((q) => q.isCorrect).length
  const incorrectCount = questions.filter((q) => q.isCorrect === false).length
  const unansweredCount = questions.filter((q) => q.selectedAnswer === null).length

  const filtered = filter === 'all'
    ? questions
    : filter === 'correct'
    ? questions.filter((q) => q.isCorrect)
    : questions.filter((q) => !q.isCorrect)

  const question = filtered[currentIdx]

  return (
    <div className="pb-20">
      {/* Score summary */}
      <Card className="mb-4">
        <CardContent className="py-4">
          <h2 className="text-lg font-semibold mb-2">Test Review</h2>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 font-medium">
              {correctCount} correct
            </span>
            <span className="text-red-600 font-medium">
              {incorrectCount} incorrect
            </span>
            {unansweredCount > 0 && (
              <span className="text-slate-400 font-medium">
                {unansweredCount} unanswered
              </span>
            )}
            <span className="text-slate-600 ml-auto font-medium">
              {correctCount}/{questions.length} ({Math.round((correctCount / questions.length) * 100)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'incorrect', 'correct'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setCurrentIdx(0) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? `All (${questions.length})` : f === 'correct' ? `Correct (${correctCount})` : `Incorrect (${incorrectCount + unansweredCount})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-500 py-8">No questions in this category</p>
      ) : (
        <>
          {/* Question navigation strip */}
          <div className="mb-4 flex flex-wrap gap-1">
            {filtered.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(i)}
                className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
                  i === currentIdx
                    ? 'bg-slate-900 text-white'
                    : q.isCorrect
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {q.question_number}
              </button>
            ))}
          </div>

          {/* Result indicator */}
          <div className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            question.isCorrect
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {question.isCorrect ? (
              <><CheckCircle2 className="h-4 w-4" /> Correct</>
            ) : (
              <><XCircle className="h-4 w-4" /> {question.selectedAnswer ? 'Incorrect' : 'Unanswered'}</>
            )}
          </div>

          {/* Question display (read-only) */}
          <ReviewQuestionCard question={question} />

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-sm text-slate-500">
              {currentIdx + 1} of {filtered.length}
            </span>

            <Button
              variant="outline"
              onClick={() => setCurrentIdx(Math.min(filtered.length - 1, currentIdx + 1))}
              disabled={currentIdx === filtered.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* Continue button */}
      <div className="mt-6 text-center">
        <Button onClick={() => {
          clearStudentStorage()
          router.push('/student/join')
        }}>
          Done
        </Button>
      </div>
    </div>
  )
}

function ReviewQuestionCard({ question }: { question: ReviewQuestion }) {
  const answers = { A: question.answer_a, B: question.answer_b, C: question.answer_c, D: question.answer_d } as const
  const letters = ['A', 'B', 'C', 'D'] as const

  return (
    <Card>
      <CardContent className="p-4">
        {/* Question text */}
        {question.question_text && (
          <p className="mb-4 text-base leading-relaxed">
            <MathTextLazy text={question.question_text} />
          </p>
        )}

        {question.has_graphic && question.image_url && (
          <div className="mb-4">
            <img
              src={question.image_url}
              alt={`Figure for question ${question.question_number}`}
              className="max-w-full rounded border border-slate-200"
            />
          </div>
        )}

        {/* Answer choices with correct/incorrect highlighting */}
        {question.answers_are_visual ? (
          <div className="flex gap-2">
            {letters.map((letter) => {
              const isSelected = question.selectedAnswer === letter
              const isCorrect = question.correct_answer === letter

              return (
                <div
                  key={letter}
                  className={`flex h-12 w-12 items-center justify-center rounded-lg border text-lg font-bold ${
                    isCorrect
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : isSelected
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {letter}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {letters.map((letter) => {
              const text = answers[letter]
              if (!text) return null

              const isSelected = question.selectedAnswer === letter
              const isCorrect = question.correct_answer === letter

              return (
                <div
                  key={letter}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
                    isCorrect
                      ? 'border-green-500 bg-green-50'
                      : isSelected
                      ? 'border-red-500 bg-red-50'
                      : 'border-slate-200'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isCorrect
                      ? 'bg-green-500 text-white'
                      : isSelected
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100'
                  }`}>
                    {letter}
                  </span>
                  <span className="text-sm"><MathTextLazy text={text} /></span>
                  {isCorrect && (
                    <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600" />
                  )}
                  {isSelected && !isCorrect && (
                    <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-600" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Lazy import to avoid issues with KaTeX SSR
function MathTextLazy({ text }: { text: string }) {
  const { MathText } = require('@/components/math/katex-renderer')
  return <MathText text={text} />
}
