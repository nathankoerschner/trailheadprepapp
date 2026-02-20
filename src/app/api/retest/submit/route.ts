import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

export async function POST(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Retest submission is just an acknowledgement — answers already saved
  return NextResponse.json({ success: true })
}
