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
import type { GridQuestion, AnswerChoice } from '@/lib/types/database'

interface QuestionDetailDialogProps {
  question: GridQuestion | null
  onOpenChange: (open: boolean) => void
}

const sectionLabels = {
  reading_writing: 'Reading & Writing',
  math: 'Math',
}

const answerLetters: AnswerChoice[] = ['A', 'B', 'C', 'D']

export function QuestionDetailDialog({ question, onOpenChange }: QuestionDetailDialogProps) {
  return (
    <Dialog open={!!question} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        {question && (
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
      </DialogContent>
    </Dialog>
  )
}
