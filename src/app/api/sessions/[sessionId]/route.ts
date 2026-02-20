import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, tests(name, total_questions)')
    .eq('id', sessionId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: students } = await supabase
    .from('session_students')
    .select('*, students(name)')
    .eq('session_id', sessionId)

  // For non-lobby statuses, include questions and student answers for the grid view
  if (session.status !== 'lobby') {
    const [{ data: questions }, { data: studentAnswers }] = await Promise.all([
      supabase
        .from('questions')
        .select('id, question_number, question_text, answer_a, answer_b, answer_c, answer_d, correct_answer, section, concept_tag, has_graphic, graphic_url, image_url, answers_are_visual')
        .eq('test_id', session.test_id)
        .order('question_number'),
      supabase
        .from('student_answers')
        .select('student_id, question_id, selected_answer, is_correct')
        .eq('session_id', sessionId),
    ])

    return NextResponse.json({
      ...session,
      session_students: students,
      questions: questions || [],
      student_answers: studentAnswers || [],
    })
  }

  return NextResponse.json({ ...session, session_students: students })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the session belongs to this user
  const { data: session } = await supabase
    .from('sessions')
    .select('id, created_by')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete cascade: child rows first, then session
  await supabase.from('retest_answers').delete().eq('session_id', sessionId)
  await supabase.from('retest_questions').delete().eq('session_id', sessionId)
  await supabase.from('student_answers').delete().eq('session_id', sessionId)
  await supabase.from('session_students').delete().eq('session_id', sessionId)
  await supabase.from('analysis_jobs').delete().eq('session_id', sessionId)

  const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
