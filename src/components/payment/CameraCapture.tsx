import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, RefreshCw, Upload } from 'lucide-react'
import Modal from '../ui/Modal'
import { cn } from '../../utils/cn'

const MAX_DIMENSION = 1600

interface CameraCaptureProps {
  open: boolean
  onClose: () => void
  /** Receives a JPEG File captured from the live camera feed. */
  onCapture: (file: File) => void
  /** Fallback: open the OS file picker (gallery / files). */
  onPickFile: () => void
  /** Fallback: open the device's native camera app. */
  onNativeCamera: () => void
}

function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow camera permission in your browser, or use one of the options below.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. Use one of the options below.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera is busy in another app. Close it and try again, or use one of the options below.'
    default:
      return 'This browser could not start the live camera. Use one of the options below.'
  }
}

/**
 * Live in-app camera capture (getUserMedia) that works on both desktop and
 * mobile. Captures a single frame to a downsized JPEG so receipts never arrive
 * as unsupported formats (e.g. HEIC) or oversized files. Always offers graceful
 * fallbacks to the native camera app and the file picker.
 */
export default function CameraCapture({
  open,
  onClose,
  onCapture,
  onPickFile,
  onNativeCamera,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setReady(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setStarting(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('unsupported', 'NotSupportedError')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => undefined)
      }
      setReady(true)
    } catch (err) {
      setError(describeCameraError(err))
    } finally {
      setStarting(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stop()
      return
    }
    void start()
    return () => stop()
  }, [open, start, stop])

  const close = useCallback(() => {
    stop()
    onClose()
  }, [onClose, stop])

  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || capturing) return
    setCapturing(true)
    try {
      const maxSide = Math.max(video.videoWidth, video.videoHeight)
      const scale = Math.min(1, MAX_DIMENSION / maxSide)
      const width = Math.max(1, Math.round(video.videoWidth * scale))
      const height = Math.max(1, Math.round(video.videoHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no-canvas')
      ctx.drawImage(video, 0, 0, width, height)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85),
      )
      if (!blob) throw new Error('no-blob')

      const file = new File([blob], `receipt-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
      stop()
      onCapture(file)
      onClose()
    } catch {
      setError('Could not capture the photo. Please try again, or use one of the options below.')
    } finally {
      setCapturing(false)
    }
  }, [capturing, onCapture, onClose, stop])

  return (
    <Modal open={open} onClose={close} title="Take a photo" size="md">
      <div className="space-y-5">
        <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-night-700 bg-black">
          <div className="relative aspect-[3/4] w-full">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={cn('h-full w-full object-cover', !ready && 'opacity-0')}
            />

            {!error && (
              <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/40" />
            )}

            {(starting || (!ready && !error)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-night-400">
                <RefreshCw className={cn('h-7 w-7', starting && 'animate-spin text-gold-500')} />
                <p className="text-xs">Starting camera…</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-night-400">
                <CameraOff className="h-8 w-8 text-night-500" />
                <p className="text-xs">{error}</p>
              </div>
            )}
          </div>
        </div>

        {!error ? (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void capture()}
              disabled={!ready || capturing}
              className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-7 py-3 text-sm font-bold uppercase tracking-widest text-night-950 transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {capturing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {capturing ? 'Capturing…' : 'Capture Photo'}
            </button>
            <p className="text-xs text-night-500">
              Frame the receipt clearly, then tap Capture.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setError(null)
                void start()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-night-700 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-night-200 hover:text-night-50"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onClick={onNativeCamera}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gold-500/50 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gold-300 hover:bg-gold-500/10"
            >
              <Camera className="h-4 w-4" />
              Device camera
            </button>
            <button
              type="button"
              onClick={onPickFile}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-night-700 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-night-200 hover:text-night-50"
            >
              <Upload className="h-4 w-4" />
              Choose file
            </button>

          </div>
        )}

        {!error && (
          <div className="flex flex-wrap justify-center gap-2 border-t border-night-800 pt-4">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-widest text-night-400 hover:text-night-200"
            >
              Choose from device instead
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
