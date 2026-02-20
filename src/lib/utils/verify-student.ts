import { verifyStudentToken } from './student-token'

export function verifyStudentRequest(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.slice(7)
  return verifyStudentToken(token)
}
