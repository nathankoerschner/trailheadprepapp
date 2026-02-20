import { createAdminClient } from '@/lib/supabase/admin'

export function generatePin(): string {
  const pin = Math.floor(100000 + Math.random() * 900000).toString()
  return pin
}

export async function generateUniquePin(): Promise<string> {
  const supabase = createAdminClient()
  let pin: string
  let exists = true

  while (exists) {
    pin = generatePin()
    const { data } = await supabase
      .from('sessions')
      .select('id')
      .eq('pin_code', pin)
      .eq('status', 'lobby')
      .maybeSingle()
    exists = !!data
  }

  return pin!
}
