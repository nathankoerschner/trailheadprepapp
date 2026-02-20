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

  const { data: groups } = await supabase
    .from('lesson_groups')
    .select('*, lesson_group_students(student_id, students(name)), lesson_plans(*)')
    .eq('session_id', sessionId)

  return NextResponse.json(groups || [])
}
