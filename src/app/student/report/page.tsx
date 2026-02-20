'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { studentFetch } from '@/lib/utils/student-api'
import type { ReportSummary } from '@/lib/openai/generate-report'

export default function StudentReportPage() {
  const router = useRouter()
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReport()
  }, [])

  async function loadReport() {
    const res = await studentFetch('/api/report')
    if (res.ok) {
      setReport(await res.json())
    }
    setLoading(false)
  }

  function handleDone() {
    localStorage.removeItem('student_token')
    localStorage.removeItem('session_id')
    localStorage.removeItem('student_id')
    localStorage.removeItem('student_name')
    router.push('/student/join')
  }

  if (loading) return <p className="text-center text-slate-500 py-12">Loading report...</p>
  if (!report) return <p className="text-center text-slate-500 py-12">No report available.</p>

  const improvementIcon = report.improvement > 0
    ? <TrendingUp className="h-5 w-5 text-green-500" />
    : report.improvement < 0
    ? <TrendingDown className="h-5 w-5 text-red-500" />
    : <Minus className="h-5 w-5 text-slate-400" />

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Your Progress Report</h1>
        <p className="mt-1 text-slate-500">{report.studentName}</p>
      </div>

      {/* Score comparison */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Practice Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{report.testScore.percentage}%</p>
            <p className="text-sm text-slate-500">
              {report.testScore.correct}/{report.testScore.total} correct
            </p>
            <Progress value={report.testScore.percentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Retest</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{report.retestScore.percentage}%</p>
            <p className="text-sm text-slate-500">
              {report.retestScore.correct}/{report.retestScore.total} correct
            </p>
            <Progress value={report.retestScore.percentage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Improvement */}
      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          {improvementIcon}
          <div>
            <p className="font-semibold">
              {report.improvement > 0 && '+'}
              {report.improvement}% change
            </p>
            <p className="text-sm text-slate-500">
              {report.improvement > 0
                ? 'Great improvement!'
                : report.improvement === 0
                ? 'Same score'
                : 'Keep practicing'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Concept breakdown */}
      {report.missedConcepts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Concepts Reviewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.missedConcepts.map((mc) => (
                <div key={mc.concept} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{mc.concept}</p>
                    <p className="text-xs text-slate-500">
                      Missed {mc.missedCount} on test
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mc.retestCorrect > 0 ? (
                      <Badge variant="success">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {mc.retestCorrect} correct on retest
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        Needs more practice
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleDone} className="w-full" size="lg">
        Done
      </Button>
    </div>
  )
}
