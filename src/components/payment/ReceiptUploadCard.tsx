import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Camera, FileImage, ImageUp, LoaderCircle, Trash2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import CameraCapture from './CameraCapture'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i
const MAX_SIZE_MB = 4
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const MAX_DIMENSION = 1600

export interface ReceiptUploadCardProps {
  file: File | null
  onChange: (file: File | null) => void
  onError?: (message: string) => void
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('decode-failed'))
    image.src = url
  })
}

/** Re-encodes any decodable image to a downsized JPEG (handles HEIC and large photos). */
async function convertToJpeg(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const maxSide = Math.max(image.width, image.height) || MAX_DIMENSION
    const scale = Math.min(1, MAX_DIMENSION / maxSide)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no-canvas')
    ctx.drawImage(image, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob) throw new Error('no-blob')

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'receipt'
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Obvious, mobile-friendly receipt uploader:
 * live in-app camera capture, drag & drop / tap-to-pick, instant preview with
 * filename + size, and Remove / Change Photo actions. Handles HEIC captures and
 * oversized photos by downsizing to JPEG, mirroring the backend rules (max 4MB).
 */
export default function ReceiptUploadCard({ file, onChange, onError, disabled }: ReceiptUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const inputId = useId()

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const accept = useCallback(
    async (candidate: File | undefined | null) => {
      if (!candidate) return
      const isImage = candidate.type.startsWith('image/') || IMAGE_EXTENSIONS.test(candidate.name)
      if (!isImage) {
        onError?.('Please choose an image file (JPG, PNG or WEBP).')
        return
      }

      const alreadySupported = ACCEPTED_TYPES.includes(candidate.type)
      if (alreadySupported && candidate.size <= MAX_SIZE_BYTES) {
        onError?.('')
        onChange(candidate)
        return
      }

      setProcessing(true)
      try {
        const prepared = await convertToJpeg(candidate)
        if (prepared.size > MAX_SIZE_BYTES) {
          onError?.(`That image is too large (${formatSize(prepared.size)}). Maximum is ${MAX_SIZE_MB}MB.`)
          return
        }
        onError?.('')
        onChange(prepared)
      } catch {
        onError?.(
          'We could not read that photo. On iPhone, set Camera format to "Most Compatible", or use Take Photo.',
        )
      } finally {
        setProcessing(false)
      }
    },
    [onChange, onError],
  )

  const openPicker = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const openNativeCamera = useCallback(() => {
    if (disabled) return
    setCameraOpen(false)
    window.setTimeout(() => cameraRef.current?.click(), 0)
  }, [disabled])

  return (
    <div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          void accept(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          void accept(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(captured) => void accept(captured)}
        onPickFile={openPicker}
        onNativeCamera={openNativeCamera}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || processing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold-500/50 px-5 py-3 text-sm font-bold uppercase tracking-widest text-gold-300 transition-colors hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageUp className="h-4 w-4" />
          Upload Receipt
        </button>
        <button
          type="button"
          data-testid="take-photo"
          onClick={() => {
            if (!disabled) setCameraOpen(true)
          }}
          disabled={disabled || processing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-bold uppercase tracking-widest text-night-950 transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Take Photo
        </button>
      </div>

      {processing && (
        <p className="mb-3 flex items-center gap-2 text-sm text-gold-300">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Preparing your image…
        </p>
      )}

      {!file ? (
        <div
          role="button"
          tabIndex={0}
          aria-labelledby={inputId}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPicker()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (!disabled) void accept(event.dataTransfer.files?.[0])
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging
              ? 'border-gold-500 bg-gold-500/10'
              : 'border-night-600 bg-night-900/50 hover:border-gold-500/60 hover:bg-gold-500/[0.04]',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-400">
            <ImageUp className="h-8 w-8" />
          </span>
          <div>
            <p className="font-display text-lg text-night-50">Upload Payment Receipt</p>
            <p className="mt-1 text-sm text-night-400">
              Take a photo or choose a screenshot of your payment receipt
            </p>
          </div>
          <p className="text-xs text-night-500">
            Drag &amp; drop here, or use the buttons above · JPG, PNG, WEBP · Max {MAX_SIZE_MB}MB
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-400">
            <FileImage className="h-4 w-4" />
            Selected Receipt
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <div className="overflow-hidden rounded-xl border border-night-700 bg-night-900">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Payment receipt preview"
                  className="aspect-[4/3] w-full object-contain sm:w-48"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-night-100">{file.name}</p>
              <p className="mt-0.5 text-xs text-night-500">Size: {formatSize(file.size)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={openPicker}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold-300 transition-colors hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageUp className="h-3.5 w-3.5" />
                  Upload Different
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) setCameraOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-night-950 transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Take New Photo
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
