'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTimer } from '@/lib/hooks/use-timer'
import { studentFetch } from '@/lib/utils/student-api'
import { formatTime } from '@/lib/utils/timer'
import { toast } from 'sonner'
import { MathText } from '@/components/math/katex-renderer'
import type { AnswerChoice } from '@/lib/types/database'


interface TestQuestion {
  id: string
  question_number: number
  image_url: string | null
  question_text: string | null
  answer_a: string | null
  answer_b: string | null
  answer_c: string | null
  answer_d: string | null
  section: string
  has_graphic: boolean
  graphic_url: string | null
  answers_are_visual: boolean
  selectedAnswer: AnswerChoice | null
}

export default function StudentTestPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Map<string, AnswerChoice>>(new Map())
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testStartedAt, setTestStartedAt] = useState<string | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(180)

  useEffect(() => {
    loadTestData()
  }, [])

  async function loadTestData() {
    const sessionId = localStorage.getItem('session_id')
    if (!sessionId) {
      router.push('/student/join')
      return
    }

    // Get session info for timer
    const statusRes = await fetch(`/api/sessions/${sessionId}/status`)
    if (statusRes.ok) {
      const status = await statusRes.json()
      setTestStartedAt(status.testStartedAt)
      setDurationMinutes(status.testDurationMinutes)

      if (status.status !== 'testing') {
        router.push('/student/lobby')
        return
      }
    }

    // Get questions
    const res = await studentFetch('/api/test/questions')
    if (!res.ok) {
      toast.error('Failed to load test')
      return
    }

    const data: TestQuestion[] = await res.json()
    setQuestions(data)

    // Restore saved answers
    const savedAnswers = new Map<string, AnswerChoice>()
    data.forEach((q) => {
      if (q.selectedAnswer) {
        savedAnswers.set(q.id, q.selectedAnswer)
      }
    })
    setAnswers(savedAnswers)
    setLoading(false)
  }

  const handleSubmit = useCallback(async () => {
    if (submitted) return
    setSubmitted(true)

    const res = await studentFetch('/api/answers/submit', { method: 'POST' })
    if (res.ok) {
      toast.success('Test submitted!')
      router.push('/student/waiting')
    } else {
      toast.error('Failed to submit')
      setSubmitted(false)
    }
  }, [submitted, router])

  const { remaining, expired } = useTimer(testStartedAt, durationMinutes, handleSubmit)

  async function selectAnswer(questionId: string, answer: AnswerChoice) {
    setAnswers((prev) => new Map(prev).set(questionId, answer))

    // Auto-save
    await studentFetch('/api/answers', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedAnswer: answer }),
    })
  }

  if (loading) return <p className="text-center text-slate-500 py-12">Loading test...</p>
  if (questions.length === 0) return <p className="text-center text-slate-500 py-12">No questions found</p>

  const question = questions[currentIdx]
  const answeredCount = answers.size

  return (
    <div className="pb-20">
      {/* Timer bar */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <div className={`flex items-center gap-1 font-mono text-lg font-bold ${
            remaining < 5 * 60 * 1000 ? 'text-red-600' : 'text-slate-900'
          }`}>
            <Clock className="h-4 w-4" />
            {formatTime(remaining)}
          </div>
          <span className="text-sm text-slate-500">
            {answeredCount}/{questions.length} answered
          </span>
        </div>
      </div>

      {/* Question navigation strip */}
      <div className="my-4 flex flex-wrap gap-1">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentIdx(i)}
            className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
              i === currentIdx
                ? 'bg-slate-900 text-white'
                : answers.has(q.id)
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {q.question_number}
          </button>
        ))}
      </div>

      {/* Question display */}
      <Card>
        <CardContent className="p-4">
          {/* Question text */}
          {question.question_text && (
            <p className="mb-4 text-base leading-relaxed">
              <MathText text={question.question_text} />
            </p>
          )}

          {/* Show image only for questions with graphics (charts, graphs, diagrams) */}
          {question.has_graphic && question.image_url && (
            <div className="mb-4">
              <img
                src={question.image_url}
                alt={`Figure for question ${question.question_number}`}
                className="max-w-full rounded border border-slate-200"
              />
            </div>
          )}

          {/* Answer choices */}
          {question.answers_are_visual ? (
            <div className="flex gap-2">
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const isSelected = answers.get(question.id) === letter
                return (
                  <button
                    key={letter}
                    onClick={() => selectAnswer(question.id, letter)}
                    className={`flex h-12 w-12 items-center justify-center rounded-lg border text-lg font-bold transition-colors ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const key = `answer_${letter.toLowerCase()}` as keyof TestQuestion
                const text = question[key] as string | null
                if (!text) return null

                const isSelected = answers.get(question.id) === letter

                return (
                  <button
                    key={letter}
                    onClick={() => selectAnswer(question.id, letter)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50 font-medium'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100'
                    }`}>
                      {letter}
                    </span>
                    <span className="text-sm"><MathText text={text} /></span>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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

        {currentIdx === questions.length - 1 ? (
          <Button onClick={handleSubmit} disabled={submitted}>
            <Send className="h-4 w-4" />
            {submitted ? 'Submitting...' : 'Submit Test'}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
