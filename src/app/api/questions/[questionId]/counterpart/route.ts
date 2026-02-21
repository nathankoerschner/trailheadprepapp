import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCounterpart } from '@/lib/openai/generate-counterpart'
import { NextResponse } from 'next/server'
import type { GridQuestion } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params

  // Auth check via user client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use admin client for queries (bypasses PostgREST schema cache issues)
  const admin = createAdminClient()

  const { data: question, error } = await admin
    .from('questions')
    .select('id, question_number, question_text, answer_a, answer_b, answer_c, answer_d, correct_answer, section, concept_tag, has_graphic, graphic_url, image_url, answers_are_visual, counterpart_json')
    .eq('id', questionId)
    .single()

  if (error || !question) {
    console.error('[counterpart] Question lookup failed:', error)
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Return cached counterpart if it exists
  if (question.counterpart_json) {
    return NextResponse.json({ counterpart: question.counterpart_json })
  }

  // Generate and cache
  try {
    const counterpart = await generateCounterpart(question as unknown as GridQuestion)

    await admin
      .from('questions')
      .update({ counterpart_json: counterpart })
      .eq('id', questionId)

    return NextResponse.json({ counterpart })
  } catch (err) {
    console.error('[counterpart] Generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate counterpart' }, { status: 500 })
  }
}
