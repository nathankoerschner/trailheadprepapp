import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSessionSchema } from '@/lib/schemas/session'
import { generateUniquePin } from '@/lib/utils/pin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tutor } = await supabase
    .from('tutors')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!tutor) return NextResponse.json({ error: 'Tutor not found' }, { status: 404 })

  const body = await request.json()
  const parsed = createSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 })
  }

  const pin = await generateUniquePin()

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      org_id: tutor.org_id,
      test_id: parsed.data.testId,
      created_by: user.id,
      pin_code: pin,
      tutor_count: parsed.data.tutorCount,
      retest_question_count: parsed.data.retestQuestionCount,
      test_duration_minutes: parsed.data.testDurationMinutes,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pre-register expected students
  const studentRows = parsed.data.studentIds.map((studentId) => ({
    session_id: session.id,
    student_id: studentId,
  }))

  // We don't insert session_students yet — students join via PIN
  // But we could track expected students. For now, skip.

  return NextResponse.json(session)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sessions')
    .select('*, tests(name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
