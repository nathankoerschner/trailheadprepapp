import OpenAI from 'openai'
import type { CounterpartQuestion, GridQuestion } from '@/lib/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are an expert SAT question writer. Given an original SAT question, generate a similar question that tests the same concept/skill but uses different context, numbers, and scenarios.

Requirements:
- Preserve the same difficulty level and format
- Test the same underlying concept or skill
- Use different numbers, names, contexts, or scenarios
- Provide exactly 4 answer choices (A-D) with one correct answer
- Return valid JSON with these fields: questionText, answerA, answerB, answerC, answerD, correctAnswer (A/B/C/D)`

export async function generateCounterpart(question: GridQuestion): Promise<CounterpartQuestion> {
  const answers = [
    question.answer_a ? `A) ${question.answer_a}` : '',
    question.answer_b ? `B) ${question.answer_b}` : '',
    question.answer_c ? `C) ${question.answer_c}` : '',
    question.answer_d ? `D) ${question.answer_d}` : '',
  ].filter(Boolean).join('\n')

  const userPrompt = `Original question (${question.section}, concept: ${question.concept_tag || 'unknown'}):

${question.question_text || 'No text available'}

${answers}

Correct answer: ${question.correct_answer}

Generate a counterpart question testing the same skill with different context.`

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 2048,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI')

  const parsed = JSON.parse(content) as CounterpartQuestion
  if (!parsed.questionText || !parsed.correctAnswer) {
    throw new Error('Invalid counterpart response format')
  }

  return parsed
}
