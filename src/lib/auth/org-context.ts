import type { User } from '@supabase/supabase-js'

export function resolveOrgIdFromUser(
  user: Pick<User, 'app_metadata' | 'user_metadata'>
): string | null {
  const candidateValues = [
    user.app_metadata?.org_id,
    user.app_metadata?.orgId,
    user.app_metadata?.organization_id,
    user.app_metadata?.organizationId,
    user.user_metadata?.org_id,
    user.user_metadata?.orgId,
    user.user_metadata?.organization_id,
    user.user_metadata?.organizationId,
  ]

  for (const value of candidateValues) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }

  return null
}

