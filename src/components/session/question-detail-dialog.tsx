'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MathText } from '@/components/math/katex-renderer'
import type { GridQuestion, AnswerChoice, CounterpartQuestion } from '@/lib/types/database'

interface QuestionDetailDialogProps {
  question: GridQuestion | null
  counterpart?: CounterpartQuestion | null
  onOpenChange: (open: boolean) => void
}

const sectionLabels = {
  reading_writing: 'Reading & Writing',
  math: 'Math',
}

const answerLetters: AnswerChoice[] = ['A', 'B', 'C', 'D']
const counterpartAnswerKeys: Record<AnswerChoice, keyof CounterpartQuestion> = {
  A: 'answerA',
  B: 'answerB',
  C: 'answerC',
  D: 'answerD',
}

export function QuestionDetailDialog({ question, counterpart, onOpenChange }: QuestionDetailDialogProps) {
  return (
    <Dialog open={!!question} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[85vh] overflow-y-auto ${counterpart ? 'max-w-4xl' : 'max-w-xl'}`}>
        {question && !counterpart && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Question {question.question_number}</DialogTitle>
                <Badge variant="secondary">{sectionLabels[question.section]}</Badge>
              </div>
              <DialogDescription>
                Correct answer: {question.correct_answer}
              </DialogDescription>
            </DialogHeader>

            {question.question_text && (
              <p className="text-sm leading-relaxed">
                <MathText text={question.question_text} />
              </p>
            )}

            {question.has_graphic && question.image_url && (
              <div>
                <img
                  src={question.image_url}
                  alt={`Figure for question ${question.question_number}`}
                  className="max-w-full rounded border border-slate-200"
                />
              </div>
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

        {question && counterpart && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Q{question.question_number} — AI Counterpart</DialogTitle>
              </div>
              <DialogDescription>
                Side-by-side comparison of the original and AI-generated question
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-6">
              {/* Original question */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">Original</h3>
                  <Badge variant="secondary">{sectionLabels[question.section]}</Badge>
                </div>

                {question.question_text && (
                  <p className="text-sm leading-relaxed">
                    <MathText text={question.question_text} />
                  </p>
                )}

                {question.has_graphic && question.image_url && (
                  <div>
                    <img
                      src={question.image_url}
                      alt={`Figure for question ${question.question_number}`}
                      className="max-w-full rounded border border-slate-200"
                    />
                  </div>
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
              </div>

              {/* AI Counterpart */}
              <div className="space-y-3 border-l border-slate-200 pl-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">AI Counterpart</h3>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">AI Generated</Badge>
                </div>

                <p className="text-sm leading-relaxed">
                  <MathText text={counterpart.questionText} />
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
