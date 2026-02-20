import { z } from 'zod/v4'

export const createSessionSchema = z.object({
  testId: z.uuid(),
  tutorCount: z.number().int().min(1).max(3),
  retestQuestionCount: z.number().int().min(5).max(50).default(20),
  testDurationMinutes: z.number().int().min(10).max(300).default(180),
  studentIds: z.array(z.uuid()).min(1),
})

export const answerSchema = z.object({
  questionId: z.uuid(),
  selectedAnswer: z.enum(['A', 'B', 'C', 'D']),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type AnswerInput = z.infer<typeof answerSchema>
