// Helper for making authenticated student API calls

import { getStudentStorageItem } from '@/lib/utils/student-storage'

export function getStudentHeaders(): HeadersInit {
  const token = getStudentStorageItem('student_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function studentFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      ...getStudentHeaders(),
      ...options?.headers,
    },
  })
}
