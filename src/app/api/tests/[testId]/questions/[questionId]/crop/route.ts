import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrgIdFromUser } from '@/lib/auth/org-context'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
) {
  const { testId, questionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let orgId = resolveOrgIdFromUser(user)
  if (!orgId) {
    const { data: tutor } = await supabase
      .from('tutors')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle()
    orgId = tutor?.org_id ?? null
  }
  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization context missing for authenticated user' },
      { status: 403 }
    )
  }

  // Get the current question
  const { data: question } = await supabase
    .from('questions')
    .select('image_url, original_image_url')
    .eq('id', questionId)
    .eq('test_id', testId)
    .single()
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 })

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${orgId}/${testId}/crops/q-${questionId}.png`

  // Upload cropped image (upsert to allow re-cropping)
  const { error: uploadError } = await admin.storage
    .from('test-images')
    .upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    })
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from('test-images').getPublicUrl(storagePath)
  const croppedUrl = `${urlData.publicUrl}?t=${Date.now()}`

  // On first crop, preserve the original full-page image URL
  const updates: Record<string, string> = { image_url: croppedUrl }
  if (!question.original_image_url) {
    updates.original_image_url = question.image_url!
  }

  const { error: updateError } = await admin
    .from('questions')
    .update(updates)
    .eq('id', questionId)
    .eq('test_id', testId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    image_url: croppedUrl,
    original_image_url: updates.original_image_url || question.original_image_url,
  })
}

// DELETE — reset to original image
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
) {
  const { testId, questionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: question } = await supabase
    .from('questions')
    .select('original_image_url')
    .eq('id', questionId)
    .eq('test_id', testId)
    .single()

  if (!question?.original_image_url) {
    return NextResponse.json({ error: 'No original image to restore' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('questions')
    .update({
      image_url: question.original_image_url,
      original_image_url: null,
    })
    .eq('id', questionId)
    .eq('test_id', testId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ image_url: question.original_image_url })
}
