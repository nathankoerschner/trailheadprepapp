'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import type { Student } from '@/lib/types/database'
import { resolveOrgIdFromUser } from '@/lib/auth/org-context'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('name')
    setStudents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    supabase
      .from('students')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (cancelled) return
        setStudents(data || [])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [supabase])

  async function addStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const orgId = await getOrgId()
    if (!orgId) {
      toast.error('Organization context missing for this account')
      return
    }

    const { error } = await supabase
      .from('students')
      .insert({ name: newName.trim(), org_id: orgId })

    if (error) {
      toast.error('Failed to add student')
      return
    }

    setNewName('')
    toast.success('Student added')
    loadStudents()
  }

  async function deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete student')
      return
    }
    toast.success('Student removed')
    loadStudents()
  }

  async function getOrgId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // First try user metadata
    const fromMeta = resolveOrgIdFromUser(user)
    if (fromMeta) return fromMeta

    // Fall back to tutors table
    const { data } = await supabase
      .from('tutors')
      .select('org_id')
      .eq('id', user.id)
      .single()
    return data?.org_id ?? null
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Students</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add Student</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addStudent} className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Student name"
              className="max-w-xs"
            />
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-slate-500">Loading...</p>
          ) : students.length === 0 ? (
            <p className="p-6 text-slate-500">No students yet</p>
          ) : (
            <ul className="divide-y">
              {students.map((student) => (
                <li key={student.id} className="flex items-center justify-between px-6 py-3">
                  <span className="font-medium">{student.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteStudent(student.id)}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
