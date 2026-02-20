import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="text-slate-500">Page not found</p>
      <Link href="/">
        <Button>Go Home</Button>
      </Link>
    </div>
  )
}
