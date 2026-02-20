// Helper for making authenticated student API calls

export function getStudentHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('student_token') : null
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
