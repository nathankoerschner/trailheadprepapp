import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { assembleRetest } from '@/lib/openai/assemble-retest'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: session } = await admin
    .from('sessions')
    .select('test_id, retest_question_count')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Get all question IDs for this test
  const { data: questions } = await admin
    .from('questions')
    .select('id')
    .eq('test_id', session.test_id)

  const allQuestionIds = questions?.map((q) => q.id) || []

  const { data: sessionStudents } = await admin
    .from('session_students')
    .select('student_id')
    .eq('session_id', sessionId)

  if (!sessionStudents?.length) {
    return NextResponse.json({ error: 'No students' }, { status: 400 })
  }

  // Mark unanswered questions as incorrect for each student
  for (const ss of sessionStudents) {
    const { data: existingAnswers } = await admin
      .from('student_answers')
      .select('question_id')
      .eq('session_id', sessionId)
      .eq('student_id', ss.student_id)

    const answeredIds = new Set(existingAnswers?.map((a) => a.question_id) || [])
    const unansweredRows = allQuestionIds
      .filter((id) => !answeredIds.has(id))
      .map((id) => ({
        session_id: sessionId,
        student_id: ss.student_id,
        question_id: id,
        selected_answer: null,
        is_correct: false,
        answered_at: new Date().toISOString(),
      }))

    if (unansweredRows.length > 0) {
      await admin.from('student_answers').insert(unansweredRows)
    }
  }

  // Assemble retest for each student
  for (const ss of sessionStudents) {
    // Check if already assembled
    const { data: existing } = await admin
      .from('retest_questions')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', ss.student_id)
      .limit(1)

    if (!existing?.length) {
      await assembleRetest(sessionId, ss.student_id, session.retest_question_count)
    }
  }

  return NextResponse.json({ success: true })
}
