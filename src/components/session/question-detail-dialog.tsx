'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MathText } from '@/components/math/katex-renderer'
import { ImageIcon, ImageOff, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { GridQuestion, AnswerChoice, CounterpartQuestion } from '@/lib/types/database'

interface QuestionDetailDialogProps {
  question: GridQuestion | null
  counterpart?: CounterpartQuestion | null
  onOpenChange: (open: boolean) => void
  onQuestionUpdate?: (questionId: string, updates: Partial<GridQuestion>) => void
}

const sectionLabels = {
  reading_writing: 'Reading & Writing',
  math: 'Math',
}

const answerLetters: AnswerChoice[] = ['A', 'B', 'C', 'D']
const answerDbKeys = {
  A: 'answer_a',
  B: 'answer_b',
  C: 'answer_c',
  D: 'answer_d',
} as const
const counterpartAnswerKeys: Record<AnswerChoice, keyof CounterpartQuestion> = {
  A: 'answerA',
  B: 'answerB',
  C: 'answerC',
  D: 'answerD',
}

export function QuestionDetailDialog({ question, counterpart, onOpenChange, onQuestionUpdate }: QuestionDetailDialogProps) {
  const [showOriginal, setShowOriginal] = useState(true)
  const [togglingImage, setTogglingImage] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editValues, setEditValues] = useState({
    question_text: '',
    answer_a: '',
    answer_b: '',
    answer_c: '',
    answer_d: '',
    correct_answer: 'A' as AnswerChoice,
  })

  // Reset edit state when question changes or dialog closes
  useEffect(() => {
    if (question) {
      setEditValues({
        question_text: question.question_text ?? '',
        answer_a: question.answer_a ?? '',
        answer_b: question.answer_b ?? '',
        answer_c: question.answer_c ?? '',
        answer_d: question.answer_d ?? '',
        correct_answer: question.correct_answer,
      })
    }
    setEditing(false)
  }, [question])

  async function saveEdits() {
    if (!question || saving) return
    setSaving(true)
    try {
      const updates: Partial<GridQuestion> = {}
      if (editValues.question_text !== (question.question_text ?? '')) updates.question_text = editValues.question_text || null
      if (editValues.answer_a !== (question.answer_a ?? '')) updates.answer_a = editValues.answer_a || null
      if (editValues.answer_b !== (question.answer_b ?? '')) updates.answer_b = editValues.answer_b || null
      if (editValues.answer_c !== (question.answer_c ?? '')) updates.answer_c = editValues.answer_c || null
      if (editValues.answer_d !== (question.answer_d ?? '')) updates.answer_d = editValues.answer_d || null
      if (editValues.correct_answer !== question.correct_answer) updates.correct_answer = editValues.correct_answer

      if (Object.keys(updates).length === 0) {
        setEditing(false)
        return
      }

      const res = await fetch(`/api/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update')
      onQuestionUpdate?.(question.id, updates)
      toast.success('Question updated')
      setEditing(false)
    } catch {
      toast.error('Failed to update question')
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    if (question) {
      setEditValues({
        question_text: question.question_text ?? '',
        answer_a: question.answer_a ?? '',
        answer_b: question.answer_b ?? '',
        answer_c: question.answer_c ?? '',
        answer_d: question.answer_d ?? '',
        correct_answer: question.correct_answer,
      })
    }
    setEditing(false)
  }

  async function toggleImage() {
    if (!question || togglingImage) return
    setTogglingImage(true)
    try {
      const res = await fetch(`/api/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_graphic: !question.has_graphic }),
      })
      if (!res.ok) throw new Error('Failed to update')
      onQuestionUpdate?.(question.id, { has_graphic: !question.has_graphic })
      toast.success(question.has_graphic ? 'Image excluded' : 'Image included')
    } catch {
      toast.error('Failed to update question')
    } finally {
      setTogglingImage(false)
    }
  }

  return (
    <Dialog open={!!question} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[85vh] overflow-y-auto ${counterpart && showOriginal ? 'max-w-4xl' : 'max-w-xl'} ${counterpart ? 'pb-0' : ''}`}>
        {question && !counterpart && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Question {question.question_number}</DialogTitle>
                <Badge variant="secondary">{sectionLabels[question.section]}</Badge>
                {question.image_url && (
                  <button
                    type="button"
                    onClick={toggleImage}
                    disabled={togglingImage}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      question.has_graphic
                        ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                    title={question.has_graphic ? 'Exclude image from student view' : 'Include image in student view'}
                  >
                    {question.has_graphic ? (
                      <><ImageIcon className="h-3.5 w-3.5" /> Image On</>
                    ) : (
                      <><ImageOff className="h-3.5 w-3.5" /> Image Off</>
                    )}
                  </button>
                )}
                {!editing ? (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="ml-auto flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={saveEdits}
                      disabled={saving}
                      className="flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  </div>
                )}
              </div>
              <DialogDescription>
                Correct answer: {editing ? editValues.correct_answer : question.correct_answer}
              </DialogDescription>
            </DialogHeader>

            {question.has_graphic && question.image_url && (
              <div>
                <img
                  src={question.image_url}
                  alt={`Figure for question ${question.question_number}`}
                  className="max-w-full rounded border border-slate-200"
                />
              </div>
            )}

            {editing ? (
              /* Edit mode */
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Question Text</label>
                  <textarea
                    value={editValues.question_text}
                    onChange={(e) => setEditValues((v) => ({ ...v, question_text: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>

                {!question.answers_are_visual && answerLetters.map((letter) => {
                  const dbKey = answerDbKeys[letter]
                  const isCorrect = editValues.correct_answer === letter
                  return (
                    <div key={letter} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditValues((v) => ({ ...v, correct_answer: letter }))}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          isCorrect
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        title={`Set ${letter} as correct answer`}
                      >
                        {letter}
                      </button>
                      <input
                        type="text"
                        value={editValues[dbKey]}
                        onChange={(e) => setEditValues((v) => ({ ...v, [dbKey]: e.target.value }))}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                          isCorrect
                            ? 'border-green-400 bg-green-50 focus:border-green-500 focus:ring-green-500'
                            : 'border-slate-300 focus:border-slate-500 focus:ring-slate-500'
                        }`}
                      />
                    </div>
                  )
                })}

                {question.answers_are_visual && (
                  <div className="flex gap-2">
                    {answerLetters.map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => setEditValues((v) => ({ ...v, correct_answer: letter }))}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                          letter === editValues.correct_answer
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Read-only mode */
              <>
                {question.question_text && (
                  <p className="text-sm leading-relaxed">
                    <MathText text={question.question_text} />
                  </p>
                )}

                {question.answers_are_visual ? (
                  <div className="flex gap-2">
                    {answerLetters.map((letter) => (
                      <div
                        key={letter}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold ${
                          letter === question.correct_answer
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {answerLetters.map((letter) => {
                      const key = `answer_${letter.toLowerCase()}` as keyof GridQuestion
                      const text = question[key] as string | null
                      if (!text) return null

                      const isCorrect = letter === question.correct_answer

                      return (
                        <div
                          key={letter}
                          className={`flex items-center gap-3 rounded-lg border p-3 ${
                            isCorrect
                              ? 'border-green-500 bg-green-50'
                              : 'border-slate-200'
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isCorrect
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="text-sm">
                            <MathText text={text} />
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {question && counterpart && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Q{question.question_number} — AI Counterpart</DialogTitle>
              </div>
              <DialogDescription>
                {showOriginal
                  ? 'Side-by-side comparison of the original and AI-generated question'
                  : 'AI-generated counterpart question'}
              </DialogDescription>
            </DialogHeader>

            <div className={`grid gap-6 ${showOriginal ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Original question */}
              {showOriginal && (<div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">Original</h3>
                  <Badge variant="secondary">{sectionLabels[question.section]}</Badge>
                  {question.image_url && (
                    <button
                      type="button"
                      onClick={toggleImage}
                      disabled={togglingImage}
                      className={`ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                        question.has_graphic
                          ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                      title={question.has_graphic ? 'Exclude image' : 'Include image'}
                    >
                      {question.has_graphic ? (
                        <><ImageIcon className="h-3 w-3" /> On</>
                      ) : (
                        <><ImageOff className="h-3 w-3" /> Off</>
                      )}
                    </button>
                  )}
                </div>

                {question.has_graphic && question.image_url && (
                  <div>
                    <img
                      src={question.image_url}
                      alt={`Figure for question ${question.question_number}`}
                      className="max-w-full rounded border border-slate-200"
                    />
                  </div>
                )}

                {question.question_text && (
                  <p className="text-sm leading-relaxed">
                    <MathText text={question.question_text} />
                  </p>
                )}

                {question.answers_are_visual ? (
                  <div className="flex gap-2">
                    {answerLetters.map((letter) => (
                      <div
                        key={letter}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${
                          letter === question.correct_answer
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {answerLetters.map((letter) => {
                      const key = `answer_${letter.toLowerCase()}` as keyof GridQuestion
                      const text = question[key] as string | null
                      if (!text) return null
                      const isCorrect = letter === question.correct_answer
                      return (
                        <div
                          key={letter}
                          className={`flex items-center gap-2 rounded-lg border p-2 ${
                            isCorrect ? 'border-green-500 bg-green-50' : 'border-slate-200'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isCorrect ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="text-sm">
                            <MathText text={text} />
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>)}

              {/* AI Counterpart */}
              <div className={`space-y-3 ${showOriginal ? 'border-l border-slate-200 pl-6' : ''}`}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">AI Counterpart</h3>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">AI Generated</Badge>
                </div>

                <p className="text-sm leading-relaxed">
                  <MathText text={counterpart.questionText.replace(/\n\s*[A-D]\)[^\n]*/g, '').trim()} />
                </p>

                <div className="space-y-1.5">
                  {answerLetters.map((letter) => {
                    const text = counterpart[counterpartAnswerKeys[letter]] as string | undefined
                    if (!text) return null
                    const isCorrect = showOriginal && letter === counterpart.correctAnswer
                    return (
                      <div
                        key={letter}
                        className={`flex items-center gap-2 rounded-lg border p-2 ${
                          isCorrect ? 'border-green-500 bg-green-50' : 'border-slate-200'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isCorrect ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="text-sm">
                          <MathText text={text} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end bg-white pt-3 pb-5">
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  showOriginal
                    ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {showOriginal ? 'Hide' : 'Show'} Original
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
