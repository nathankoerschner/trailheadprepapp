import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DeleteSessionButton } from '@/components/session/delete-session-button'
import type { Session } from '@/lib/types/database'

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  lobby: 'secondary',
  testing: 'warning',
  analyzing: 'warning',
  lesson: 'default',
  retest: 'default',
  complete: 'success',
}

export default async function TutorDashboard() {
  const supabase = await createClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, tests(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link href="/tutor/sessions/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        </Link>
      </div>

      {!sessions?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-slate-500">No sessions yet</p>
            <Link href="/tutor/sessions/new">
              <Button>Create your first session</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session: Session & { tests: { name: string } }) => (
            <Link key={session.id} href={`/tutor/sessions/${session.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {(session as unknown as { tests: { name: string } }).tests.name}
                    </CardTitle>
                    <Badge variant={statusColors[session.status]}>
                      {session.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>PIN: {session.pin_code}</span>
                    <div className="flex items-center gap-2">
                      <span>{new Date(session.created_at).toLocaleDateString()}</span>
                      <DeleteSessionButton sessionId={session.id} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
