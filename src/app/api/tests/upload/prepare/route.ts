import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrgIdFromUser } from '@/lib/auth/org-context'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

interface PrepareUploadFile {
  name?: string
  mimeType?: string
}

interface PrepareUploadRequest {
  name?: string
  pages?: PrepareUploadFile[]
  originalPdf?: PrepareUploadFile | null
}

function guessExtension(name: string | undefined, mimeType: string | undefined): string {
  const normalizedMime = (mimeType || '').toLowerCase()
  const fromName = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (fromName) return fromName
  if (normalizedMime === 'application/pdf') return 'pdf'
  if (normalizedMime === 'image/jpeg') return 'jpg'
  if (normalizedMime === 'image/webp') return 'webp'
  if (normalizedMime === 'image/png') return 'png'
  return 'bin'
}

async function resolveOrgIdForPrepare(
  user: User,
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const fromClaims = resolveOrgIdFromUser(user)
  if (fromClaims) return fromClaims

  const { data: tutor } = await supabase
    .from('tutors')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle()
  if (tutor?.org_id) return tutor.org_id

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  let orgId = org?.id
  if (!orgId) {
    orgId = crypto.randomUUID()
    const { error: orgCreateError } = await admin
      .from('organizations')
      .insert({ id: orgId, name: 'Default Organization' })
    if (orgCreateError) {
      throw new Error(`Failed to bootstrap organization: ${orgCreateError.message}`)
    }
  }

  const displayName =
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user.email ||
    'Tutor'
  const email = user.email || `${user.id}@local.invalid`

  const { error: tutorUpsertError } = await admin.from('tutors').upsert({
    id: user.id,
    org_id: orgId,
    name: displayName,
    email,
  })
  if (tutorUpsertError) {
    throw new Error(`Failed to bootstrap tutor profile: ${tutorUpsertError.message}`)
  }

  return orgId
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let orgId: string | null = null
  try {
    orgId = await resolveOrgIdForPrepare(user, supabase, admin)
  } catch (err) {
    console.error('Failed to resolve org context for upload prepare:', err)
    return NextResponse.json({ error: 'Failed to initialize account for uploads' }, { status: 500 })
  }

  if (!orgId) {
    return NextResponse.json(
      { error: 'Unable to resolve organization context for upload preparation' },
      { status: 500 }
    )
  }

  let body: PrepareUploadRequest
  try {
    body = (await request.json()) as PrepareUploadRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }
  const testName = body.name?.trim()
  const pages = Array.isArray(body.pages) ? body.pages : []

  if (!testName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  if (pages.length === 0) {
    return NextResponse.json({ error: 'At least one page image is required' }, { status: 400 })
  }

  const hasInvalidPageMime = pages.some((page) => !String(page.mimeType || '').startsWith('image/'))
  if (hasInvalidPageMime) {
    return NextResponse.json({ error: 'All page files must be images' }, { status: 400 })
  }

  const { data: test, error: testError } = await admin
    .from('tests')
    .insert({
      org_id: orgId,
      name: testName,
      created_by: user.id,
      status: 'processing',
    })
    .select()
    .single()

  if (testError || !test) {
    return NextResponse.json(
      { error: `Failed to create test${testError ? `: ${testError.message}` : ''}` },
      { status: 500 }
    )
  }

  const uploads: Array<{
    pageNumber: number
    path: string
    token: string
    mimeType: string
  }> = []

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const mimeType = page.mimeType || 'image/png'
    const ext = guessExtension(page.name, mimeType)
    const path = `${orgId}/${test.id}/pages/page-${i + 1}.${ext}`
    const { data: signed, error } = await admin.storage
      .from('test-images')
      .createSignedUploadUrl(path)
    if (error || !signed) {
      await admin.from('tests').update({ status: 'error' }).eq('id', test.id)
      return NextResponse.json({ error: 'Failed to create signed upload URL' }, { status: 500 })
    }

    uploads.push({
      pageNumber: i + 1,
      path,
      token: signed.token,
      mimeType,
    })
  }

  let originalPdfUpload:
    | {
        path: string
        token: string
        mimeType: string
      }
    | undefined

  if (body.originalPdf) {
    const mimeType = body.originalPdf.mimeType || 'application/pdf'
    if (mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'originalPdf must be a PDF file' }, { status: 400 })
    }
    const ext = guessExtension(body.originalPdf.name, mimeType)
    const path = `${orgId}/${test.id}/original.${ext}`
    const { data: signed, error } = await admin.storage
      .from('test-images')
      .createSignedUploadUrl(path)
    if (error || !signed) {
      await admin.from('tests').update({ status: 'error' }).eq('id', test.id)
      return NextResponse.json({ error: 'Failed to create signed upload URL' }, { status: 500 })
    }
    originalPdfUpload = {
      path,
      token: signed.token,
      mimeType,
    }
  }

  return NextResponse.json({
    testId: test.id,
    status: 'prepared',
    uploads,
    originalPdfUpload,
  })
}
