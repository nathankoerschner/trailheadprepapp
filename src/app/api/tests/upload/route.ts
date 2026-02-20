import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { pdf } from 'pdf-to-img'
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
  const file = formData.get('file') as File | null
  const testName = formData.get('name') as string | null

  if (!file || !testName) {
    return NextResponse.json({ error: 'File and name are required' }, { status: 400 })
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
  processTestUpload(file, test.id, tutor.org_id, admin).catch(async (err) => {
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

async function pdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const images: Buffer[] = []
  const doc = await pdf(pdfBuffer, { scale: 2 })
  for await (const page of doc) {
    images.push(Buffer.from(page))
  }
  return images
}

async function processTestUpload(
  file: File,
  testId: string,
  orgId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const pages: PageData[] = []

  if (file.type === 'application/pdf') {
    // Upload full PDF for reference
    const pdfPath = `${orgId}/${testId}/original.pdf`
    await admin.storage.from('test-images').upload(pdfPath, buffer, {
      contentType: 'application/pdf',
    })

    // Convert PDF pages to PNG images
    console.log('Converting PDF to images...')
    const pngBuffers = await pdfToImages(buffer)
    console.log(`Converted PDF to ${pngBuffers.length} PNG pages`)

    for (let i = 0; i < pngBuffers.length; i++) {
      const pngBuffer = pngBuffers[i]

      // Upload PNG to storage
      const imagePath = `${orgId}/${testId}/page-${i + 1}.png`
      await admin.storage.from('test-images').upload(imagePath, pngBuffer, {
        contentType: 'image/png',
      })
      const { data: pageUrl } = admin.storage.from('test-images').getPublicUrl(imagePath)

      // Base64 for OpenAI
      const base64 = pngBuffer.toString('base64')
      pages.push({
        base64,
        mimeType: 'image/png',
        storageUrl: pageUrl.publicUrl,
      })
    }
  } else {
    // Single image upload
    const ext = file.name.split('.').pop() || 'png'
    const imagePath = `${orgId}/${testId}/page-1.${ext}`
    await admin.storage.from('test-images').upload(imagePath, buffer, {
      contentType: file.type,
    })
    const { data: imgUrl } = admin.storage.from('test-images').getPublicUrl(imagePath)

    const base64 = buffer.toString('base64')
    pages.push({
      base64,
      mimeType: file.type,
      storageUrl: imgUrl.publicUrl,
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
