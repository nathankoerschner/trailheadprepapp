import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

// Record a practice answer (client-side grading, just acknowledge)
export async function POST(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Practice answers are checked client-side for instant feedback
  // We could store them for analytics, but for MVP just acknowledge
  return NextResponse.json({ success: true })
}
