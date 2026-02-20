'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Test, Student } from '@/lib/types/database'

export default function NewSessionPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tests, setTests] = useState<Test[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedTest, setSelectedTest] = useState('')
  const [tutorCount, setTutorCount] = useState('1')
  const [retestCount, setRetestCount] = useState('20')
  const [duration, setDuration] = useState('180')
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      const [testsRes, studentsRes] = await Promise.all([
        supabase.from('tests').select('*').eq('status', 'ready').order('created_at', { ascending: false }),
        supabase.from('students').select('*').order('name'),
      ])
      setTests(testsRes.data || [])
      setStudents(studentsRes.data || [])
      // Select all students by default
      if (studentsRes.data) {
        setSelectedStudents(new Set(studentsRes.data.map((s) => s.id)))
      }
    }
    load()
  }, [])

  function toggleStudent(id: string) {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTest || selectedStudents.size === 0) {
      toast.error('Select a test and at least one student')
      return
    }

    setCreating(true)

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testId: selectedTest,
        tutorCount: parseInt(tutorCount),
        retestQuestionCount: parseInt(retestCount),
        testDurationMinutes: parseInt(duration),
        studentIds: Array.from(selectedStudents),
      }),
    })

    if (!res.ok) {
      toast.error('Failed to create session')
      setCreating(false)
      return
    }

    const session = await res.json()
    toast.success(`Session created! PIN: ${session.pin_code}`)
    router.push(`/tutor/sessions/${session.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">New Session</h1>

      <form onSubmit={handleCreate} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Test</Label>
              <Select value={selectedTest} onValueChange={setSelectedTest}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a test" />
                </SelectTrigger>
                <SelectContent>
                  {tests.map((test) => (
                    <SelectItem key={test.id} value={test.id}>
                      {test.name} ({test.total_questions} questions)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tutors</Label>
                <Select value={tutorCount} onValueChange={setTutorCount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Retest Questions</Label>
                <Input
                  type="number"
                  value={retestCount}
                  onChange={(e) => setRetestCount(e.target.value)}
                  min={5}
                  max={50}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min={10}
                  max={300}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Student Roster</CardTitle>
              <span className="text-sm text-slate-500">{selectedStudents.size} selected</span>
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-slate-500">No students. Add some first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {students.map((student) => (
                  <label
                    key={student.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                      selectedStudents.has(student.id)
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.has(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">{student.name}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={creating}>
          {creating ? 'Creating...' : 'Create Session'}
        </Button>
      </form>
    </div>
  )
}
