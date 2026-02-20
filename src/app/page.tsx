import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900">Trailhead Prep</h1>
        <p className="mt-2 text-lg text-slate-600">SAT Assessment & Adaptive Tutoring</p>
      </div>
      <div className="flex gap-4">
        <Link href="/login">
          <Button size="lg">Tutor Login</Button>
        </Link>
        <Link href="/student/join">
          <Button size="lg" variant="outline">Student Join</Button>
        </Link>
      </div>
    </div>
  )
}
