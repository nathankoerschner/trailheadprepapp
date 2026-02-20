import { z } from 'zod/v4'

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
})

export const studentJoinSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/, 'PIN must be 6 digits'),
  studentId: z.uuid(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type StudentJoinInput = z.infer<typeof studentJoinSchema>
