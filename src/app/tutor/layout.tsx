import Link from 'next/link'
import { BookOpen, Users, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TutorNav } from './tutor-nav'

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const displayName =
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user.email ||
    ''

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/tutor" className="text-xl font-bold text-slate-900">
            Trailhead Prep
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{displayName}</span>
            <TutorNav />
          </div>
        </div>
      </header>
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl gap-6 px-4 sm:px-6">
          <Link
            href="/tutor"
            className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            <ClipboardList className="h-4 w-4" />
            Sessions
          </Link>
          <Link
            href="/tutor/tests"
            className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            <BookOpen className="h-4 w-4" />
            Tests
          </Link>
          <Link
            href="/tutor/students"
            className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            <Users className="h-4 w-4" />
            Students
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
