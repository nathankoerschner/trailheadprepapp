'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QuestionDisplay } from '@/components/question/question-display'
import { useTimer } from '@/lib/hooks/use-timer'
import { studentFetch } from '@/lib/utils/student-api'
import { clearStudentStorage } from '@/lib/utils/student-storage'
import { formatTime } from '@/lib/utils/timer'
import { toast } from 'sonner'
import type { AnswerChoice } from '@/lib/types/database'


interface RetestQuestion {
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
  retestOrder: number
  source: string
}

export default function StudentRetestPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<RetestQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Map<string, AnswerChoice>>(new Map())
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [startedAt] = useState(new Date().toISOString())

  useEffect(() => {
    loadRetestData()
  }, [])

  async function loadRetestData() {
    const res = await studentFetch('/api/retest/questions')
    if (!res.ok) {
      toast.error('Failed to load retest')
      return
    }

    const data = await res.json()
    setQuestions(data.questions || [])
    setDurationMinutes(data.duration || 30)

    // Restore saved answers
    const savedAnswers = new Map<string, AnswerChoice>()
    data.questions?.forEach((q: RetestQuestion) => {
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

    await studentFetch('/api/retest/submit', { method: 'POST' })
    toast.success('Retest submitted!')
    router.push('/student/review')
  }, [submitted, router])

  const { remaining } = useTimer(startedAt, durationMinutes, handleSubmit)

  async function selectAnswer(questionId: string, answer: AnswerChoice) {
    setAnswers((prev) => new Map(prev).set(questionId, answer))

    await studentFetch('/api/retest/answer', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedAnswer: answer }),
    })
  }

  if (loading) return <p className="text-center text-slate-500 py-12">Loading retest...</p>
  if (questions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No retest questions found.</p>
        <Button onClick={() => {
          clearStudentStorage()
          router.push('/student/join')
        }} className="mt-4">
          Done
        </Button>
      </div>
    )
  }

  const question = questions[currentIdx]
  const answeredCount = answers.size

  return (
    <div className="pb-20">
      {/* Timer bar */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Retest</Badge>
            <span className="text-sm text-slate-500">
              {currentIdx + 1} of {questions.length}
            </span>
          </div>
          <div className={`flex items-center gap-1 font-mono text-lg font-bold ${
            remaining < 3 * 60 * 1000 ? 'text-red-600' : 'text-slate-900'
          }`}>
            <Clock className="h-4 w-4" />
            {formatTime(remaining)}
          </div>
          <span className="text-sm text-slate-500">
            {answeredCount}/{questions.length}
          </span>
        </div>
      </div>

      {/* Navigation strip */}
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
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question */}
      <QuestionDisplay
        questionText={question.question_text}
        imageUrl={question.image_url}
        hasGraphic={question.has_graphic}
        questionNumber={question.question_number}
        answersAreVisual={question.answers_are_visual}
        answerA={question.answer_a}
        answerB={question.answer_b}
        answerC={question.answer_c}
        answerD={question.answer_d}
        selectedAnswer={answers.get(question.id) ?? null}
        onSelectAnswer={(answer) => selectAnswer(question.id, answer)}
      />

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
            {submitted ? 'Submitting...' : 'Submit Retest'}
          </Button>
        ) : (
          <Button onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
