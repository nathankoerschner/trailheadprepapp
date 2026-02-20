import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrgIdFromUser } from '@/lib/auth/org-context'
import { NextResponse } from 'next/server'

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

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = resolveOrgIdFromUser(user)
  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization context missing for authenticated user' },
      { status: 403 }
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

  const admin = createAdminClient()

  const { data: test, error: testError } = await supabase
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
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 })
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
