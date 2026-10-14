import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff, Search } from 'lucide-react'
import { cn } from '../../utils/cn'

let regionCounter = 0

/**
 * Camera + manual booking-reference scanner. Starts the rear camera on mount,
 * stops on unmount, and hands the first decoded value to `onDecode` (after
 * stopping, so a single code never fires twice). Falls back to a manual
 * reference form when the camera is unavailable or permission is denied.
 */
export default function QrCameraScanner({
  onDecode,
  onManual,
}: {
  onDecode: (text: string) => void
  onManual: (reference: string) => void
}) {
  const regionIdRef = useRef(`sawaba-qr-region-${(regionCounter += 1)}`)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const decodedRef = useRef(onDecode)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    decodedRef.current = onDecode
  }, [onDecode])

  const stop = useCallback(async () => {
    const instance = scannerRef.current
    if (!instance) {
      setCameraOn(false)
      return
    }
    scannerRef.current = null
    try {
      await instance.stop()
      instance.clear()
    } catch {
      // already stopped
    }
    setCameraOn(false)
  }, [])

  const start = useCallback(async () => {
    if (scannerRef.current) return
    setCameraError(null)
    const regionId = regionIdRef.current
    if (!document.getElementById(regionId)) return
    const instance = new Html5Qrcode(regionId, { verbose: false })
    scannerRef.current = instance
    try {
      await instance.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72)
            return { width: size, height: size }
          },
          aspectRatio: 1,
        },
        (text) => {
          void stop().then(() => decodedRef.current(text))
        },
        () => {},
      )
      setCameraOn(true)
    } catch {
      scannerRef.current = null
      setCameraError(
        'Camera is unavailable on this device or permission was denied. Enter the booking reference below instead.',
      )
    }
  }, [stop])

  useEffect(() => {
    void start()
    return () => {
      void stop()
    }
  }, [start, stop])

  return (
    <div className="space-y-4 rounded-2xl border border-night-800 bg-night-900/50 p-4 sm:p-5">
      <div className="mx-auto w-full max-w-[300px]">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-night-700 bg-black">
          <div id={regionIdRef.current} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

          {cameraOn && (
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <span className="absolute left-4 top-4 h-6 w-6 rounded-tl border-l-2 border-t-2 border-gold-400/80" />
              <span className="absolute right-4 top-4 h-6 w-6 rounded-tr border-r-2 border-t-2 border-gold-400/80" />
              <span className="absolute bottom-4 left-4 h-6 w-6 rounded-bl border-b-2 border-l-2 border-gold-400/80" />
              <span className="absolute bottom-4 right-4 h-6 w-6 rounded-br border-b-2 border-r-2 border-gold-400/80" />
            </div>
          )}

          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-night-500">
              <CameraOff className="h-8 w-8" />
              <p className="max-w-xs text-xs">{cameraError ?? 'Camera is off.'}</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-center">
          {!cameraOn ? (
            <button
              type="button"
              onClick={() => void start()}
              className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-gold-400"
            >
              <Camera className="h-4 w-4" />
              {cameraError ? 'Retry camera' : 'Start camera'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stop()}
              className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 hover:text-night-100"
            >
              <CameraOff className="h-4 w-4" />
              Stop camera
            </button>
          )}
        </div>

        {cameraOn && (
          <p className="mt-2 text-center text-xs text-night-500">
            Point the camera at the customer's booking QR code.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
          Manual lookup
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const value = manual.trim()
            if (value) onManual(value)
          }}
          className="flex gap-2"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Booking reference e.g. APT-20260101-001"
            className="min-w-0 flex-1 rounded-lg border border-night-700 bg-night-950 px-3 py-2 text-sm text-night-100 placeholder:text-night-600 focus:border-gold-500/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manual.trim()}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/20 disabled:opacity-50',
            )}
          >
            <Search className="h-4 w-4" />
            Verify
          </button>
        </form>
      </div>
    </div>
  )
}
