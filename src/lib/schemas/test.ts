import { z } from 'zod/v4'

export const updateQuestionSchema = z.object({
  questionText: z.string().optional(),
  answerA: z.string().optional(),
  answerB: z.string().optional(),
  answerC: z.string().optional(),
  answerD: z.string().optional(),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']).optional(),
  section: z.enum(['reading_writing', 'math']).optional(),
  conceptTag: z.string().optional(),
})

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>
