import OpenAI from 'openai'
import type { AnswerChoice, QuestionSection } from '@/lib/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface ExtractedQuestion {
  questionNumber: number
  questionText: string
  answerA: string
  answerB: string
  answerC: string
  answerD: string
  correctAnswer: AnswerChoice
  section: QuestionSection
  conceptTag: string
  hasGraphic: boolean
  answersAreVisual: boolean
  aiConfidence: number
}

const SYSTEM_PROMPT = `You are an expert SAT question extractor. Extract ALL questions visible in the images.
For each question, provide:
- questionNumber: the question number as shown on the page
- questionText: the COMPLETE question text. For reading/writing questions, you MUST include the full passage or text excerpt that the question refers to, followed by the question stem. Use newlines (\\n) to separate distinct parts: the passage introduction, the passage itself, and the question stem. For math questions, use newlines between the setup and the question.
- answerA, answerB, answerC, answerD: the four answer choices as text. If the question is free-response (student-produced response) with no printed choices, generate four plausible multiple-choice options with one correct answer and three realistic distractors.
- correctAnswer: your best determination of the correct answer (A, B, C, or D)
- section: "reading_writing" or "math"
- conceptTag: a specific SAT skill tag (e.g., "systems of equations", "subject-verb agreement", "inference", "quadratic functions")
- hasGraphic: true if the question contains a figure, graph, or image that is essential to answering it
- answersAreVisual: true if the answer choices themselves are graphs, diagrams, or images rather than text. When true, provide brief text descriptions of each answer choice.
- aiConfidence: 0.0-1.0 confidence in the extraction accuracy

IMPORTANT:
- Extract ALL questions you can see. Do not skip any questions.
- Every question MUST have all four answer choices (answerA through answerD) filled in. Never leave them empty. For free-response questions, generate plausible multiple-choice options.
- For reading/writing questions, the questionText MUST include the passage/text excerpt followed by the question stem.

Return valid JSON with a "questions" array. If no questions are visible, return {"questions": []}.`

export async function extractQuestionsFromBase64(
  base64Data: string,
  mimeType: string,
  pageNumber: number,
  _startQuestionNumber: number
): Promise<ExtractedQuestion[]> {
  return extractQuestionsFromPages(
    [{ base64: base64Data, mimeType }],
    pageNumber,
  )
}

interface PageImage {
  base64: string
  mimeType: string
}

export async function extractQuestionsFromPages(
  pages: PageImage[],
  startPageNumber: number,
): Promise<ExtractedQuestion[]> {
  const imageContent = pages.map((page) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:${page.mimeType};base64,${page.base64}`,
      detail: 'high' as const,
    },
  }))

  const pageLabel = pages.length === 1
    ? `page ${startPageNumber}`
    : `pages ${startPageNumber}-${startPageNumber + pages.length - 1}`

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text' as const,
            text: `Extract ALL SAT questions from ${pageLabel}. Include the full passage text in questionText for reading/writing questions. Return a JSON object with a "questions" array.`,
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 8192,
  })

  const content = response.choices[0]?.message?.content
  if (!content) return []

  try {
    const parsed = JSON.parse(content)
    const questions = parsed.questions || parsed
    if (!Array.isArray(questions)) return []
    return questions
  } catch {
    return []
  }
}
