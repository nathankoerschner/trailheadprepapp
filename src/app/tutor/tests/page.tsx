'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Test } from '@/lib/types/database'

const statusBadge: Record<string, 'secondary' | 'success' | 'destructive'> = {
  processing: 'secondary',
  ready: 'success',
  error: 'destructive',
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testName, setTestName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadTests()
    // Poll for processing tests
    const interval = setInterval(loadTests, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadTests() {
    const { data } = await supabase
      .from('tests')
      .select('*')
      .order('created_at', { ascending: false })
    setTests(data || [])
    setLoading(false)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxFiles: 1,
  })

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !testName.trim()) return

    setUploading(true)
    setUploadStatus('')

    try {
      const formData = new FormData()
      formData.append('name', testName.trim())

      if (selectedFile.type === 'application/pdf') {
        setUploadStatus('Converting PDF pages to PNG...')
        const pageImages = await convertPdfToPngFiles(selectedFile)
        for (const pageImage of pageImages) {
          formData.append('pages', pageImage)
        }
        formData.append('originalPdf', selectedFile)
      } else {
        formData.append('pages', selectedFile)
      }

      setUploadStatus('Uploading page images...')
      const res = await fetch('/api/tests/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        toast.error('Upload failed')
        return
      }

      toast.success('Test uploaded! AI is extracting questions...')
      setDialogOpen(false)
      setTestName('')
      setSelectedFile(null)
      loadTests()
    } catch (error) {
      console.error(error)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setUploadStatus('')
    }
  }

  async function convertPdfToPngFiles(file: File): Promise<File[]> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = pdfjs.getDocument({
      data: await file.arrayBuffer(),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableWorker: true,
    })
    const pdfDocument = await loadingTask.promise
    const files: File[] = []

    for (let i = 1; i <= pdfDocument.numPages; i++) {
      setUploadStatus(`Converting PDF pages to PNG (${i}/${pdfDocument.numPages})...`)
      const page = await pdfDocument.getPage(i)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)

      const context = canvas.getContext('2d')
      if (!context) throw new Error('Failed to create canvas context')

      await page.render({ canvasContext: context, viewport }).promise

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result)
          else reject(new Error('Failed to render PDF page to PNG'))
        }, 'image/png')
      })

      files.push(new File([blob], `${file.name.replace(/\.pdf$/i, '')}-page-${i}.png`, { type: 'image/png' }))
    }

    return files
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tests</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4" />
              Upload Test
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload SAT Test</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-name">Test Name</Label>
                <Input
                  id="test-name"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g. SAT Practice Test 1"
                  required
                />
              </div>
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragActive ? 'border-slate-400 bg-slate-50' : 'border-slate-200'
                }`}
              >
                <input {...getInputProps()} />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-slate-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                    <p className="text-sm text-slate-500">
                      Drop a PDF or image here, or click to browse
                    </p>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={uploading || !selectedFile}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadStatus || 'Uploading...'}
                  </>
                ) : (
                  'Upload & Extract'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : tests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-slate-500">No tests uploaded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <Link key={test.id} href={test.status === 'ready' ? `/tutor/tests/${test.id}/review` : '#'}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{test.name}</CardTitle>
                    <Badge variant={statusBadge[test.status]}>
                      {test.status === 'processing' && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {test.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">
                    {test.total_questions} questions
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
