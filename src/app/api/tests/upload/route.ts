import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrgIdFromUser } from '@/lib/auth/org-context'
import { NextResponse } from 'next/server'
import { extractQuestionsFromPages, type ExtractedQuestion } from '@/lib/openai/extract-questions'
import type { User } from '@supabase/supabase-js'

interface JsonPageReference {
  path?: string
  mimeType?: string
  pageNumber?: number
}

interface JsonUploadPayload {
  testId?: string
  pages?: JsonPageReference[]
  originalPdfPath?: string | null
}

async function resolveOrgIdForUpload(
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let orgId: string | null = null
  try {
    orgId = await resolveOrgIdForUpload(user, supabase, admin)
  } catch (err) {
    console.error('Failed to resolve org context for upload:', err)
    return NextResponse.json({ error: 'Failed to initialize account for uploads' }, { status: 500 })
  }

  if (!orgId) {
    return NextResponse.json(
      { error: 'Unable to resolve organization context for upload' },
      { status: 500 }
    )
  }

  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    let body: JsonUploadPayload
    try {
      body = (await request.json()) as JsonUploadPayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }
    const testId = body.testId
    const pageRefs = Array.isArray(body.pages) ? body.pages : []
    const originalPdfPath = typeof body.originalPdfPath === 'string' ? body.originalPdfPath : null

    if (!testId) {
      return NextResponse.json({ error: 'testId is required' }, { status: 400 })
    }

    const normalizedRefs = pageRefs
      .map((page, idx) => ({
        path: page.path || '',
        mimeType: page.mimeType || inferMimeTypeFromPath(page.path || ''),
        pageNumber: typeof page.pageNumber === 'number' ? page.pageNumber : idx + 1,
      }))
      .filter((page) => page.path.length > 0)
      .sort((a, b) => a.pageNumber - b.pageNumber)

    if (normalizedRefs.length === 0) {
      return NextResponse.json({ error: 'At least one page image is required' }, { status: 400 })
    }
    if (normalizedRefs.some((page) => !page.mimeType.startsWith('image/'))) {
      return NextResponse.json({ error: 'All page files must be images' }, { status: 400 })
    }

    const expectedPrefix = `${orgId}/${testId}/`
    const hasInvalidPath = normalizedRefs.some((page) => !page.path.startsWith(expectedPrefix))
    if (hasInvalidPath || (originalPdfPath && !originalPdfPath.startsWith(expectedPrefix))) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 })
    }

    const { data: test } = await admin
      .from('tests')
      .select('id')
      .eq('id', testId)
      .eq('org_id', orgId)
      .single()

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    console.log(`[upload] Starting stored upload processing for test ${test.id} — ${normalizedRefs.length} page(s), org ${orgId}`)
    processStoredUpload(normalizedRefs, originalPdfPath, test.id, orgId, admin).catch(async (err) => {
      console.error(`[upload] Test ${test.id} processing FAILED:`, err)
      await admin.from('tests').update({ status: 'error' }).eq('id', test.id)
    })

    return NextResponse.json({ testId: test.id, status: 'processing' })
  }

  const formData = await request.formData()
  const pages = formData.getAll('pages').filter((value): value is File => value instanceof File)
  const singleFile = formData.get('file')
  const originalPdf = formData.get('originalPdf')
  const testName = formData.get('name') as string | null
  const pdfFile = originalPdf instanceof File ? originalPdf : null

  if (!testName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const normalizedPages = pages.length > 0
    ? pages
    : singleFile instanceof File
      ? [singleFile]
      : []

  if (normalizedPages.length === 0) {
    return NextResponse.json({ error: 'At least one page image is required' }, { status: 400 })
  }

  // Create test record
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
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 })
  }

  // Legacy multipart fallback
  console.log(`[upload] Starting multipart upload processing for test ${test.id} — ${normalizedPages.length} page(s), org ${orgId}`)
  processMultipartUpload(normalizedPages, pdfFile, test.id, orgId, admin).catch(async (err) => {
    console.error(`[upload] Test ${test.id} multipart processing FAILED:`, err)
    await admin.from('tests').update({ status: 'error' }).eq('id', test.id)
  })

  return NextResponse.json({ testId: test.id, status: 'processing' })
}

interface PageData {
  base64: string
  mimeType: string
  storageUrl: string
}

function inferMimeTypeFromPath(path: string): string {
  const extension = path.toLowerCase().split('.').pop()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  return 'image/png'
}

async function processStoredUpload(
  pageRefs: Array<{ path: string; mimeType: string; pageNumber: number }>,
  originalPdfPath: string | null,
  testId: string,
  orgId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  const pipelineStart = Date.now()
  console.log(`[upload:${testId.slice(0, 8)}] Pipeline started — downloading ${pageRefs.length} page(s) from storage`)

  const expectedPrefix = `${orgId}/${testId}/`
  if (originalPdfPath && !originalPdfPath.startsWith(expectedPrefix)) {
    throw new Error('Invalid original PDF storage path')
  }

  const pages: PageData[] = []

  for (const pageRef of pageRefs) {
    if (!pageRef.path.startsWith(expectedPrefix)) {
      throw new Error(`Invalid page storage path: ${pageRef.path}`)
    }

    const dlStart = Date.now()
    const { data, error } = await admin.storage.from('test-images').download(pageRef.path)
    if (error || !data) {
      console.error(`[upload:${testId.slice(0, 8)}] Failed to download ${pageRef.path}:`, error)
      throw new Error(`Failed to download page image: ${pageRef.path}`)
    }

    const pageBuffer = Buffer.from(await data.arrayBuffer())
    const dlElapsed = ((Date.now() - dlStart) / 1000).toFixed(1)
    console.log(`[upload:${testId.slice(0, 8)}] Downloaded page ${pageRef.pageNumber} (${Math.round(pageBuffer.length / 1024)}KB) in ${dlElapsed}s`)

    const { data: pageUrl } = admin.storage.from('test-images').getPublicUrl(pageRef.path)

    pages.push({
      base64: pageBuffer.toString('base64'),
      mimeType: pageRef.mimeType || inferMimeTypeFromPath(pageRef.path),
      storageUrl: pageUrl.publicUrl,
    })
  }

  const downloadElapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1)
  console.log(`[upload:${testId.slice(0, 8)}] All pages downloaded in ${downloadElapsed}s — starting extraction`)

  await extractAndStoreQuestions(pages, testId, admin)

  const totalElapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1)
  console.log(`[upload:${testId.slice(0, 8)}] Pipeline complete in ${totalElapsed}s`)
}

async function processMultipartUpload(
  pageFiles: File[],
  originalPdf: File | null,
  testId: string,
  orgId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  const pages: PageData[] = []

  if (originalPdf?.type === 'application/pdf') {
    const pdfBuffer = Buffer.from(await originalPdf.arrayBuffer())
    const pdfPath = `${orgId}/${testId}/original.pdf`
    await admin.storage.from('test-images').upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
    })
  }

  for (let i = 0; i < pageFiles.length; i++) {
    const pageFile = pageFiles[i]
    if (!pageFile.type.startsWith('image/')) {
      throw new Error(`Unsupported page file type: ${pageFile.type}`)
    }
    const pageBuffer = Buffer.from(await pageFile.arrayBuffer())
    const ext = pageFile.type === 'image/jpeg'
      ? 'jpg'
      : pageFile.type === 'image/webp'
        ? 'webp'
        : 'png'
    const imagePath = `${orgId}/${testId}/page-${i + 1}.${ext}`

    await admin.storage.from('test-images').upload(imagePath, pageBuffer, {
      contentType: pageFile.type,
    })
    const { data: pageUrl } = admin.storage.from('test-images').getPublicUrl(imagePath)

    pages.push({
      base64: pageBuffer.toString('base64'),
      mimeType: pageFile.type,
      storageUrl: pageUrl.publicUrl,
    })
  }

  await extractAndStoreQuestions(pages, testId, admin)
}

async function extractAndStoreQuestions(
  pages: PageData[],
  testId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  const tag = `[extract:${testId.slice(0, 8)}]`
  const extractionStart = Date.now()

  // Pass 1: Extract questions page-by-page to maximize coverage
  const allQuestions: ExtractedQuestion[] = []
  // Track which page each question came from
  const questionPageMap: number[] = []

  console.log(`${tag} Pass 1: Extracting questions from ${pages.length} page(s)...`)
  for (let i = 0; i < pages.length; i++) {
    console.log(`${tag} Page ${i + 1}/${pages.length} — sending to OpenAI...`)
    const questions = await extractQuestionsFromPages(
      [{ base64: pages[i].base64, mimeType: pages[i].mimeType }],
      i + 1,
    )
    for (const q of questions) {
      allQuestions.push(q)
      questionPageMap.push(i)
    }
    console.log(`${tag} Page ${i + 1}: found ${questions.length} questions (${allQuestions.length} cumulative)`)
  }

  const pass1Elapsed = ((Date.now() - extractionStart) / 1000).toFixed(1)
  console.log(`${tag} Pass 1 complete in ${pass1Elapsed}s — ${allQuestions.length} questions found`)

  // Pass 2: Re-extract R/W questions missing passage context using page pairs
  const reextractCandidates = allQuestions.filter(
    (q, idx) => q.section === 'reading_writing' && (q.questionText || '').length < 120 && questionPageMap[idx] > 0
  )
  console.log(`${tag} Pass 2: ${reextractCandidates.length} R/W question(s) need passage context re-extraction`)

  const pass2Start = Date.now()
  for (let idx = 0; idx < allQuestions.length; idx++) {
    const q = allQuestions[idx]
    const pageIdx = questionPageMap[idx]
    if (q.section === 'reading_writing' && (q.questionText || '').length < 120 && pageIdx > 0) {
      console.log(`${tag} Re-extracting Q${q.questionNumber} (${(q.questionText || '').length} chars) with page pair ${pageIdx}+${pageIdx + 1}...`)
      const paired = await extractQuestionsFromPages(
        [
          { base64: pages[pageIdx - 1].base64, mimeType: pages[pageIdx - 1].mimeType },
          { base64: pages[pageIdx].base64, mimeType: pages[pageIdx].mimeType },
        ],
        pageIdx,
      )
      // Find the matching question by number and replace if it has longer text
      const match = paired.find((p) => p.questionNumber === q.questionNumber)
      if (match && (match.questionText || '').length > (q.questionText || '').length) {
        allQuestions[idx] = match
        console.log(`${tag}   Q${q.questionNumber} replaced: ${(q.questionText || '').length} → ${match.questionText.length} chars`)
      } else {
        console.log(`${tag}   Q${q.questionNumber} kept original (no improvement)`)
      }
    }
  }

  const pass2Elapsed = ((Date.now() - pass2Start) / 1000).toFixed(1)
  console.log(`${tag} Pass 2 complete in ${pass2Elapsed}s`)

  // Filter out empty questions but keep ones with invalid answers (flag for review)
  const validAnswers = new Set(['A', 'B', 'C', 'D'])
  const validSections = new Set(['reading_writing', 'math'])
  const withText: { q: ExtractedQuestion; pageIdx: number }[] = []
  for (let i = 0; i < allQuestions.length; i++) {
    if (allQuestions[i].questionText) {
      withText.push({ q: allQuestions[i], pageIdx: questionPageMap[i] })
    }
  }

  let flaggedCount = 0
  console.log(`${tag} ${withText.length} questions with text out of ${allQuestions.length} extracted`)

  // Insert questions — use sequential numbering to avoid unique constraint violations
  if (withText.length > 0) {
    const rows = withText.map(({ q, pageIdx }, idx) => {
      const answer = String(q.correctAnswer || '').toUpperCase().trim()
      const hasValidAnswer = validAnswers.has(answer)
      if (!hasValidAnswer) flaggedCount++

      return {
        test_id: testId,
        question_number: idx + 1,
        image_url: pages[pageIdx]?.storageUrl || pages[0]?.storageUrl,
        question_text: q.questionText,
        answer_a: q.answerA || '',
        answer_b: q.answerB || '',
        answer_c: q.answerC || '',
        answer_d: q.answerD || '',
        correct_answer: hasValidAnswer ? answer : 'A',
        section: validSections.has(q.section) ? q.section : 'reading_writing',
        concept_tag: q.conceptTag || 'general',
        ai_confidence: hasValidAnswer ? (typeof q.aiConfidence === 'number' ? q.aiConfidence : 0.5) : 0,
        has_graphic: q.hasGraphic ?? false,
        answers_are_visual: q.answersAreVisual ?? false,
      }
    })

    if (flaggedCount > 0) {
      console.log(`${tag} ${flaggedCount} questions flagged for review (invalid correct_answer, confidence set to 0)`)
    }

    const { error: insertError } = await admin.from('questions').insert(rows)
    if (insertError) {
      console.error(`${tag} Question insert FAILED:`, insertError)
      throw new Error(`Failed to insert questions: ${insertError.message}`)
    }
    console.log(`${tag} Inserted ${rows.length} questions into database`)
  }

  // Update test status
  const { error: updateError } = await admin
    .from('tests')
    .update({
      status: 'ready',
      total_questions: withText.length,
    })
    .eq('id', testId)

  if (updateError) {
    console.error(`${tag} Failed to update test status to ready:`, updateError)
  }

  const totalElapsed = ((Date.now() - extractionStart) / 1000).toFixed(1)
  console.log(`${tag} Extraction complete in ${totalElapsed}s — ${withText.length} questions stored`)
}
