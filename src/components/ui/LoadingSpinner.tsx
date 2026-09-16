import { LoaderCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

interface LoadingSpinnerProps {
  className?: string
  label?: string
}

export default function LoadingSpinner({
  className,
  label = 'Loading',
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
      <p className="text-sm text-night-400">{label}...</p>
    </div>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      className={cn('h-4 w-4 animate-spin text-gold-500', className)}
      aria-hidden="true"
    />
  )
}