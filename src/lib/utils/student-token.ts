import { createHmac } from 'crypto'

interface StudentTokenPayload {
  studentId: string
  sessionId: string
  exp: number
}

const SECRET = () => process.env.STUDENT_TOKEN_SECRET || 'dev-secret-change-me'

function sign(payload: string): string {
  return createHmac('sha256', SECRET()).update(payload).digest('hex')
}

export function createStudentToken(studentId: string, sessionId: string): string {
  const payload: StudentTokenPayload = {
    studentId,
    sessionId,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function verifyStudentToken(token: string): StudentTokenPayload | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expectedSig = sign(encoded)
    if (signature !== expectedSig) return null

    const payload: StudentTokenPayload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString()
    )

    if (Date.now() > payload.exp) return null

    return payload
  } catch {
    return null
  }
}
