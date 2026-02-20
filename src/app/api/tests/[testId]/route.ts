import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the test belongs to the tutor's org before deleting
  const { data: test, error: fetchError } = await supabase
    .from('tests')
    .select('id, org_id')
    .eq('id', testId)
    .single()

  if (fetchError || !test) {
    return NextResponse.json({ error: 'Test not found' }, { status: 404 })
  }

  // Delete test images from storage
  const { data: questions } = await supabase
    .from('questions')
    .select('image_url, original_image_url')
    .eq('test_id', testId)

  if (questions && questions.length > 0) {
    const paths = questions
      .flatMap(q => [q.image_url, q.original_image_url])
      .filter((url): url is string => !!url)
      .map(url => {
        // Extract storage path from full URL
        const match = url.match(/test-images\/(.+)/)
        return match ? match[1] : null
      })
      .filter((p): p is string => !!p)

    if (paths.length > 0) {
      await supabase.storage.from('test-images').remove(paths)
    }
  }

  // Delete the test (cascades to questions, sessions, answers)
  const { error } = await supabase
    .from('tests')
    .delete()
    .eq('id', testId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
