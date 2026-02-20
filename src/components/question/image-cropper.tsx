'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ImageCropperProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  onCropComplete: (blob: Blob) => Promise<void>
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type DragMode =
  | { type: 'draw'; startX: number; startY: number }
  | { type: 'move'; offsetX: number; offsetY: number }
  | { type: 'resize'; handle: string; startRect: Rect }

const HANDLE_SIZE = 10
const MIN_SIZE = 20

/** Compute the actual rendered image rect within an object-contain img element */
function getRenderedImageRect(img: HTMLImageElement) {
  const elemRect = img.getBoundingClientRect()
  const scale = Math.min(
    elemRect.width / img.naturalWidth,
    elemRect.height / img.naturalHeight,
  )
  const renderedW = img.naturalWidth * scale
  const renderedH = img.naturalHeight * scale
  const offsetX = (elemRect.width - renderedW) / 2
  const offsetY = (elemRect.height - renderedH) / 2
  return {
    left: elemRect.left + offsetX,
    top: elemRect.top + offsetY,
    width: renderedW,
    height: renderedH,
    offsetX,
    offsetY,
  }
}

export function ImageCropper({ open, onOpenChange, imageUrl, onCropComplete }: ImageCropperProps) {
  const [selection, setSelection] = useState<Rect | null>(null)
  const [saving, setSaving] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<DragMode | null>(null)
  const selectionRef = useRef<Rect | null>(null)

  // Keep ref in sync for use in mousemove handler
  selectionRef.current = selection

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelection(null)
      setImageLoaded(false)
    }
  }, [open])

  // Convert display coords to position relative to the actual rendered image
  const toImageCoords = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current
    if (!img) return { x: 0, y: 0 }
    const rendered = getRenderedImageRect(img)
    return {
      x: Math.max(0, Math.min(clientX - rendered.left, rendered.width)),
      y: Math.max(0, Math.min(clientY - rendered.top, rendered.height)),
    }
  }, [])

  const getImageDisplayRect = useCallback(() => {
    const img = imgRef.current
    if (!img) return { width: 0, height: 0 }
    const rendered = getRenderedImageRect(img)
    return { width: rendered.width, height: rendered.height }
  }, [])

  const clampRect = useCallback((r: Rect): Rect => {
    const { width, height } = getImageDisplayRect()
    const w = Math.max(MIN_SIZE, Math.min(r.w, width))
    const h = Math.max(MIN_SIZE, Math.min(r.h, height))
    const x = Math.max(0, Math.min(r.x, width - w))
    const y = Math.max(0, Math.min(r.y, height - h))
    return { x, y, w, h }
  }, [getImageDisplayRect])

  const getHandle = useCallback((px: number, py: number, sel: Rect): string | null => {
    const hs = HANDLE_SIZE
    const edges: [string, boolean][] = [
      ['nw', px >= sel.x - hs && px <= sel.x + hs && py >= sel.y - hs && py <= sel.y + hs],
      ['ne', px >= sel.x + sel.w - hs && px <= sel.x + sel.w + hs && py >= sel.y - hs && py <= sel.y + hs],
      ['sw', px >= sel.x - hs && px <= sel.x + hs && py >= sel.y + sel.h - hs && py <= sel.y + sel.h + hs],
      ['se', px >= sel.x + sel.w - hs && px <= sel.x + sel.w + hs && py >= sel.y + sel.h - hs && py <= sel.y + sel.h + hs],
      ['n', px >= sel.x + hs && px <= sel.x + sel.w - hs && py >= sel.y - hs && py <= sel.y + hs],
      ['s', px >= sel.x + hs && px <= sel.x + sel.w - hs && py >= sel.y + sel.h - hs && py <= sel.y + sel.h + hs],
      ['w', px >= sel.x - hs && px <= sel.x + hs && py >= sel.y + hs && py <= sel.y + sel.h - hs],
      ['e', px >= sel.x + sel.w - hs && px <= sel.x + sel.w + hs && py >= sel.y + hs && py <= sel.y + sel.h - hs],
    ]
    for (const [name, hit] of edges) {
      if (hit) return name
    }
    return null
  }, [])

  const isInsideSelection = useCallback((px: number, py: number, sel: Rect): boolean => {
    return px >= sel.x && px <= sel.x + sel.w && py >= sel.y && py <= sel.y + sel.h
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const { x, y } = toImageCoords(e.clientX, e.clientY)
    const sel = selectionRef.current

    if (sel) {
      const handle = getHandle(x, y, sel)
      if (handle) {
        dragRef.current = { type: 'resize', handle, startRect: { ...sel } }
        return
      }
      if (isInsideSelection(x, y, sel)) {
        dragRef.current = { type: 'move', offsetX: x - sel.x, offsetY: y - sel.y }
        return
      }
    }

    // Start drawing new selection
    dragRef.current = { type: 'draw', startX: x, startY: y }
    setSelection({ x, y, w: 0, h: 0 })
  }, [toImageCoords, getHandle, isInsideSelection])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current
    if (!drag) {
      // Update cursor
      const { x, y } = toImageCoords(e.clientX, e.clientY)
      const sel = selectionRef.current
      const container = containerRef.current
      if (!container) return

      if (sel) {
        const handle = getHandle(x, y, sel)
        if (handle) {
          const cursors: Record<string, string> = {
            nw: 'nwse-resize', se: 'nwse-resize',
            ne: 'nesw-resize', sw: 'nesw-resize',
            n: 'ns-resize', s: 'ns-resize',
            e: 'ew-resize', w: 'ew-resize',
          }
          container.style.cursor = cursors[handle] || 'default'
          return
        }
        if (isInsideSelection(x, y, sel)) {
          container.style.cursor = 'move'
          return
        }
      }
      container.style.cursor = 'crosshair'
      return
    }

    e.preventDefault()
    const { x, y } = toImageCoords(e.clientX, e.clientY)
    const { width: imgW, height: imgH } = getImageDisplayRect()

    if (drag.type === 'draw') {
      const nx = Math.min(drag.startX, x)
      const ny = Math.min(drag.startY, y)
      const nw = Math.abs(x - drag.startX)
      const nh = Math.abs(y - drag.startY)
      setSelection(clampRect({ x: nx, y: ny, w: nw, h: nh }))
    } else if (drag.type === 'move') {
      const sel = selectionRef.current!
      setSelection(clampRect({
        x: x - drag.offsetX,
        y: y - drag.offsetY,
        w: sel.w,
        h: sel.h,
      }))
    } else if (drag.type === 'resize') {
      const { handle, startRect } = drag
      const sel = { ...startRect }
      if (handle.includes('e')) sel.w = Math.max(MIN_SIZE, Math.min(x - sel.x, imgW - sel.x))
      if (handle.includes('s')) sel.h = Math.max(MIN_SIZE, Math.min(y - sel.y, imgH - sel.y))
      if (handle.includes('w')) {
        const right = sel.x + sel.w
        const newX = Math.max(0, Math.min(x, right - MIN_SIZE))
        sel.w = right - newX
        sel.x = newX
      }
      if (handle.includes('n')) {
        const bottom = sel.y + sel.h
        const newY = Math.max(0, Math.min(y, bottom - MIN_SIZE))
        sel.h = bottom - newY
        sel.y = newY
      }
      setSelection(sel)
    }
  }, [toImageCoords, getHandle, isInsideSelection, getImageDisplayRect, clampRect])

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current
    if (drag?.type === 'draw') {
      // If the drawn area is too small, clear it
      const sel = selectionRef.current
      if (sel && (sel.w < MIN_SIZE || sel.h < MIN_SIZE)) {
        setSelection(null)
      }
    }
    dragRef.current = null
  }, [])

  async function handleSave() {
    if (!selection || !imgRef.current) return
    setSaving(true)
    try {
      // Convert display selection to natural image pixel coordinates
      const img = imgRef.current
      const rendered = getRenderedImageRect(img)
      const scaleX = img.naturalWidth / rendered.width
      const scaleY = img.naturalHeight / rendered.height
      const pixelCrop = {
        x: Math.round(selection.x * scaleX),
        y: Math.round(selection.y * scaleY),
        width: Math.round(selection.w * scaleX),
        height: Math.round(selection.h * scaleY),
      }
      const blob = await getCroppedImage(imageUrl, pixelCrop)
      await onCropComplete(blob)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Crop Question Image</DialogTitle>
          <DialogDescription>
            Click and drag to select a region. Drag the selection to move it, or drag its edges to resize.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-lg bg-slate-900 select-none"
          style={{ cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Source image to crop"
            className="block max-h-[65vh] w-full object-contain"
            crossOrigin="anonymous"
            draggable={false}
            onLoad={() => setImageLoaded(true)}
          />
          {imageLoaded && selection && selection.w > 0 && selection.h > 0 && (
            <SelectionOverlay selection={selection} imgRef={imgRef} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !selection}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SelectionOverlay({
  selection,
  imgRef,
}: {
  selection: Rect
  imgRef: React.RefObject<HTMLImageElement | null>
}) {
  const img = imgRef.current
  if (!img) return null
  const rendered = getRenderedImageRect(img)
  const containerRect = img.parentElement?.getBoundingClientRect()
  if (!containerRect) return null

  // Offset of rendered image within the container
  const offsetX = rendered.left - containerRect.left
  const offsetY = rendered.top - containerRect.top

  const left = offsetX + selection.x
  const top = offsetY + selection.y

  return (
    <>
      {/* Dark overlay outside selection using clip-path */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'rgba(0,0,0,0.5)',
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% ${top}px,
            ${left}px ${top}px,
            ${left}px ${top + selection.h}px,
            ${left + selection.w}px ${top + selection.h}px,
            ${left + selection.w}px ${top}px,
            0% ${top}px
          )`,
        }}
      />
      {/* Selection border */}
      <div
        className="pointer-events-none absolute border-2 border-white"
        style={{
          left, top,
          width: selection.w,
          height: selection.h,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
        }}
      >
        {/* Resize handles */}
        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            width: 10,
            height: 10,
            background: 'white',
            border: '1px solid rgba(0,0,0,0.3)',
            borderRadius: 2,
          }
          if (handle.includes('n')) style.top = -5
          if (handle.includes('s')) style.bottom = -5
          if (handle.includes('w')) style.left = -5
          if (handle.includes('e')) style.right = -5
          if (handle === 'n' || handle === 's') { style.left = '50%'; style.marginLeft = -5 }
          if (handle === 'w' || handle === 'e') { style.top = '50%'; style.marginTop = -5 }
          return <div key={handle} style={style} />
        })}
      </div>
    </>
  )
}

function getCroppedImage(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = crop.width
      canvas.height = crop.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      )
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/png')
    }
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = imageSrc
  })
}
