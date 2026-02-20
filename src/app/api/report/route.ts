import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'
import { generateReport } from '@/lib/openai/generate-report'

export async function GET(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Check if report already exists
  const { data: existing } = await supabase
    .from('progress_reports')
    .select('summary')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(existing.summary)
  }

  // Generate report
  const report = await generateReport(student.sessionId, student.studentId)

  // Save report
  await supabase.from('progress_reports').upsert({
    session_id: student.sessionId,
    student_id: student.studentId,
    summary: report as unknown as Record<string, unknown>,
  }, { onConflict: 'session_id,student_id' })

  return NextResponse.json(report)
}
