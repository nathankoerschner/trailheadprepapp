import OpenAI from 'openai'
import type { CounterpartQuestion, GridQuestion } from '@/lib/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MATH_QUESTION_GEN_PROMPT = `You are an expert SAT question writer. Given an original SAT math question, generate a similar question that tests the same concept/skill but uses different context, numbers, and scenarios.

Requirements:
- Preserve the same difficulty level and format
- Test the same underlying concept or skill
- Use different numbers, names, contexts, or scenarios
- Return valid JSON with a single field: questionText`

const RW_QUESTION_GEN_PROMPT = `You are an expert SAT question writer. Given an original SAT Reading & Writing question, generate a similar question that tests the same concept/skill but uses a completely different passage, context, and wording.

Requirements:
- Preserve the same difficulty level and question format
- Test the same underlying concept or skill (e.g. vocabulary in context, text structure, inference)
- Write a new passage or text excerpt on a different topic
- The correct answer must use DIFFERENT words/phrasing than the original — do not reuse the same answer text
- All answer choices must be freshly written, not copied from the original
- Return valid JSON with a single field: questionText`

const MATH_ANSWER_GEN_PROMPT = `You are an expert SAT question writer. Given an SAT math question, generate exactly 4 multiple choice answer options (A-D) and identify the correct answer.

Requirements:
- One answer must be clearly correct
- Distractors should be plausible but incorrect
- Answer choices should be similar in length and format
- Return valid JSON with these fields: answerA, answerB, answerC, answerD, correctAnswer (A/B/C/D)`

const RW_ANSWER_GEN_PROMPT = `You are an expert SAT question writer. Given an SAT Reading & Writing question, generate exactly 4 multiple choice answer options (A-D) and identify the correct answer.

Requirements:
- One answer must be clearly correct
- Distractors should be plausible but incorrect
- Answer choices should be similar in length and format
- All answer choices must use DIFFERENT words and phrasing from the original question's answers — do not reuse any of the original answer text
- For vocabulary questions, use different synonyms or related words, not the same terms
- Return valid JSON with these fields: answerA, answerB, answerC, answerD, correctAnswer (A/B/C/D)`

export async function generateCounterpart(question: GridQuestion): Promise<CounterpartQuestion> {
  const answers = [
    question.answer_a ? `A) ${question.answer_a}` : '',
    question.answer_b ? `B) ${question.answer_b}` : '',
    question.answer_c ? `C) ${question.answer_c}` : '',
    question.answer_d ? `D) ${question.answer_d}` : '',
  ].filter(Boolean).join('\n')

  const isRW = question.section === 'reading_writing'
  const questionSystemPrompt = isRW ? RW_QUESTION_GEN_PROMPT : MATH_QUESTION_GEN_PROMPT
  const answerSystemPrompt = isRW ? RW_ANSWER_GEN_PROMPT : MATH_ANSWER_GEN_PROMPT

  // Step 1: Generate the question text
  const questionPrompt = `Original question (${question.section}, concept: ${question.concept_tag || 'unknown'}):

${question.question_text || 'No text available'}

${answers}

Correct answer: ${question.correct_answer}

Generate a counterpart question testing the same skill with different context.`

  const questionResponse = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: questionSystemPrompt },
      { role: 'user', content: questionPrompt },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 1024,
  })

  const questionContent = questionResponse.choices[0]?.message?.content
  if (!questionContent) throw new Error('Empty response from OpenAI (question generation)')

  const { questionText } = JSON.parse(questionContent) as { questionText: string }
  if (!questionText) throw new Error('Invalid question generation response')

  // Step 2: Generate answer choices and correct answer
  const originalAnswersNote = isRW
    ? `\n\nOriginal answer choices (DO NOT reuse these words or phrasing):\n${answers}\nCorrect was: ${question.correct_answer}`
    : ''

  const answerPrompt = `Question (${question.section}, concept: ${question.concept_tag || 'unknown'}):

${questionText}

Generate 4 multiple choice answers (A-D) and indicate the correct one.${originalAnswersNote}`

  const answerResponse = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: answerSystemPrompt },
      { role: 'user', content: answerPrompt },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 1024,
  })

  const answerContent = answerResponse.choices[0]?.message?.content
  if (!answerContent) throw new Error('Empty response from OpenAI (answer generation)')

  const parsedAnswers = JSON.parse(answerContent) as Omit<CounterpartQuestion, 'questionText'>
  if (!parsedAnswers.correctAnswer || !parsedAnswers.answerA) {
    throw new Error('Invalid answer generation response')
  }

  return {
    questionText,
    ...parsedAnswers,
  }
}
