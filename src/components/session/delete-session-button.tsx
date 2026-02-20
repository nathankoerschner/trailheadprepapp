'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!confirming) {
      setConfirming(true)
      return
    }

    setDeleting(true)
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Session deleted')
      router.refresh()
    } else {
      toast.error('Failed to delete session')
    }
    setDeleting(false)
    setConfirming(false)
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(false)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={deleting}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <button
      onClick={handleDelete}
      className="rounded p-1 text-slate-300 hover:text-red-500 transition-colors"
      title="Delete session"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
