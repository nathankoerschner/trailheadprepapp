import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params

  // Auth check via user client (tutor only)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Build update object from allowed fields
  const allowedFields = ['has_graphic', 'question_text', 'answer_a', 'answer_b', 'answer_c', 'answer_d', 'correct_answer'] as const
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate correct_answer if provided
  if ('correct_answer' in updates && !['A', 'B', 'C', 'D'].includes(updates.correct_answer as string)) {
    return NextResponse.json({ error: 'correct_answer must be A, B, C, or D' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('questions')
    .update(updates)
    .eq('id', questionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
