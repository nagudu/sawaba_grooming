import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Camera, FileImage, ImageUp, Trash2 } from 'lucide-react'
import { cn } from '../../utils/cn'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

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

/**
 * Obvious, mobile-friendly receipt uploader:
 * drag & drop / tap-to-pick, a dedicated camera button on phones, instant
 * preview with filename + size, and Remove / Change Photo actions.
 * Client-side validation mirrors the backend rules (JPG/PNG/WEBP, max 5MB).
 */
export default function ReceiptUploadCard({ file, onChange, onError, disabled }: ReceiptUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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
    (candidate: File | undefined | null) => {
      if (!candidate) return
      if (!ACCEPTED_TYPES.includes(candidate.type)) {
        onError?.('That file type is not supported. Please upload a JPG, PNG or WEBP image.')
        return
      }
      if (candidate.size > MAX_SIZE_BYTES) {
        onError?.(`That image is too large (${formatSize(candidate.size)}). Maximum is ${MAX_SIZE_MB}MB.`)
        return
      }
      onChange(candidate)
    },
    [onChange, onError],
  )

  const openPicker = () => inputRef.current?.click()
  const openCamera = () => cameraRef.current?.click()

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    accept(event.dataTransfer.files?.[0])
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      {/* Camera input: on phones this opens the camera directly; on desktop it behaves like the picker */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {!file ? (
        <div
          role="button"
          tabIndex={0}
          aria-labelledby={inputId}
          onClick={() => !disabled && openPicker()}
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
          onDrop={handleDrop}
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
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-night-950">
              <ImageUp className="h-4 w-4" />
              Choose Photo
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                if (!disabled) openCamera()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gold-500/50 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gold-300 transition-colors hover:bg-gold-500/10"
            >
              <Camera className="h-4 w-4" />
              Take Photo
            </button>
          </div>
          <p className="mt-1 text-xs text-night-500">JPG, PNG, WEBP · Max {MAX_SIZE_MB}MB</p>
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
                  className="rounded-lg border border-gold-500/50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold-300 transition-colors hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Change Photo
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
