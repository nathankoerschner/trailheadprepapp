'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Upload, FileText, Loader2, Trash2 } from 'lucide-react'
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

interface PrepareUploadResponse {
  testId: string
  uploads: Array<{
    pageNumber: number
    path: string
    token: string
    mimeType: string
  }>
  originalPdfUpload?: {
    path: string
    token: string
    mimeType: string
  }
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testName, setTestName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Test | null>(null)
  const [deleting, setDeleting] = useState(false)
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

    let preparedTestId: string | null = null

    try {
      const pageImages = selectedFile.type === 'application/pdf'
        ? await convertPdfToPngFiles(selectedFile)
        : [selectedFile]

      setUploadStatus('Preparing secure uploads...')
      const prepareRes = await fetch('/api/tests/upload/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName.trim(),
          pages: pageImages.map((page) => ({
            name: page.name,
            mimeType: page.type,
          })),
          originalPdf: selectedFile.type === 'application/pdf'
            ? { name: selectedFile.name, mimeType: selectedFile.type }
            : null,
        }),
      })

      if (!prepareRes.ok) {
        toast.error('Upload failed')
        return
      }

      const prepared = (await prepareRes.json()) as PrepareUploadResponse
      preparedTestId = prepared.testId

      if (prepared.uploads.length !== pageImages.length) {
        throw new Error('Upload target count mismatch')
      }

      if (selectedFile.type === 'application/pdf' && prepared.originalPdfUpload) {
        setUploadStatus('Uploading original PDF...')
        const { error } = await supabase.storage
          .from('test-images')
          .uploadToSignedUrl(
            prepared.originalPdfUpload.path,
            prepared.originalPdfUpload.token,
            selectedFile
          )
        if (error) throw error
      }

      await uploadPagesInChunks(pageImages, prepared.uploads)

      setUploadStatus('Starting extraction...')
      const res = await fetch('/api/tests/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: prepared.testId,
          pages: prepared.uploads.map((upload) => ({
            pageNumber: upload.pageNumber,
            path: upload.path,
            mimeType: upload.mimeType,
          })),
          originalPdfPath: prepared.originalPdfUpload?.path || null,
        }),
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
      if (preparedTestId) {
        await supabase
          .from('tests')
          .update({ status: 'error' })
          .eq('id', preparedTestId)
      }
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setUploadStatus('')
    }
  }

  async function uploadPagesInChunks(
    pageImages: File[],
    uploads: PrepareUploadResponse['uploads'],
  ): Promise<void> {
    const concurrency = 3

    for (let i = 0; i < uploads.length; i += concurrency) {
      const chunk = uploads.slice(i, i + concurrency)
      setUploadStatus(`Uploading page images (${Math.min(i + chunk.length, uploads.length)}/${uploads.length})...`)

      await Promise.all(
        chunk.map(async (upload) => {
          const pageFile = pageImages[upload.pageNumber - 1]
          if (!pageFile) {
            throw new Error(`Missing page file for page ${upload.pageNumber}`)
          }
          const { error } = await supabase.storage
            .from('test-images')
            .uploadToSignedUrl(upload.path, upload.token, pageFile)
          if (error) throw error
        }),
      )
    }
  }

  async function convertPdfToPngFiles(file: File): Promise<File[]> {
    setUploadStatus('Converting PDF pages to PNG...')
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()

    const loadingTask = pdfjs.getDocument({
      data: await file.arrayBuffer(),
      useWorkerFetch: false,
      isEvalSupported: false,
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

      await page.render({ canvas, canvasContext: context, viewport }).promise

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

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tests/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete test')
        return
      }
      toast.success('Test deleted')
      setDeleteTarget(null)
      loadTests()
    } catch {
      toast.error('Failed to delete test')
    } finally {
      setDeleting(false)
    }
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
            <Card key={test.id} className="transition-shadow hover:shadow-md">
              <Link href={test.status === 'ready' ? `/tutor/tests/${test.id}/review` : '#'}>
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
              </Link>
              <CardContent className="pt-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-red-600"
                  onClick={(e) => {
                    e.preventDefault()
                    setDeleteTarget(test)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also
            delete all associated questions, sessions, and student answers. This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
