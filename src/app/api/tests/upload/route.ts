import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { extractQuestionsFromPages, type ExtractedQuestion } from '@/lib/openai/extract-questions'

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

  const admin = createAdminClient()

  // Create test record
  const { data: test, error: testError } = await supabase
    .from('tests')
    .insert({
      org_id: tutor.org_id,
      name: testName,
      created_by: user.id,
      status: 'processing',
    })
    .select()
    .single()

  if (testError || !test) {
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 })
  }

  // Process in background — upload images, then extract
  processTestUpload(normalizedPages, pdfFile, test.id, tutor.org_id, admin).catch(async (err) => {
    console.error('Test processing failed:', err)
    await admin.from('tests').update({ status: 'error' }).eq('id', test.id)
  })

  return NextResponse.json({ testId: test.id, status: 'processing' })
}

interface PageData {
  base64: string
  mimeType: string
  storageUrl: string
}

async function processTestUpload(
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

  // Pass 1: Extract questions page-by-page to maximize coverage
  const allQuestions: ExtractedQuestion[] = []
  // Track which page each question came from
  const questionPageMap: number[] = []

  for (let i = 0; i < pages.length; i++) {
    console.log(`Extracting questions from page ${i + 1}/${pages.length}...`)
    const questions = await extractQuestionsFromPages(
      [{ base64: pages[i].base64, mimeType: pages[i].mimeType }],
      i + 1,
    )
    for (const q of questions) {
      allQuestions.push(q)
      questionPageMap.push(i)
    }
    console.log(`Found ${questions.length} questions on page ${i + 1} (${allQuestions.length} total)`)
  }

  // Pass 2: Re-extract R/W questions missing passage context using page pairs
  for (let idx = 0; idx < allQuestions.length; idx++) {
    const q = allQuestions[idx]
    const pageIdx = questionPageMap[idx]
    if (q.section === 'reading_writing' && (q.questionText || '').length < 120 && pageIdx > 0) {
      console.log(`Re-extracting Q${q.questionNumber} with previous page for passage context...`)
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
        console.log(`  Replaced with ${match.questionText.length} chars (was ${(q.questionText || '').length})`)
      }
    }
  }

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
  console.log(`${withText.length} questions with text out of ${allQuestions.length} extracted`)

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
      console.log(`${flaggedCount} questions flagged for review (invalid correct_answer, confidence set to 0)`)
    }

    const { error: insertError } = await admin.from('questions').insert(rows)
    if (insertError) {
      console.error('Question insert error:', insertError)
    }
  }

  // Update test status
  await admin
    .from('tests')
    .update({
      status: 'ready',
      total_questions: withText.length,
    })
    .eq('id', testId)

  console.log(`Test ${testId} processing complete: ${allQuestions.length} questions extracted`)
}
