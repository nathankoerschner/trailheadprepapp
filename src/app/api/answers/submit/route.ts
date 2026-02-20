import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

export async function POST(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Mark as submitted
  const { error } = await supabase
    .from('session_students')
    .update({
      test_submitted: true,
      test_submitted_at: new Date().toISOString(),
    })
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
