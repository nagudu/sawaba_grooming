import { Star } from 'lucide-react'
import { cn } from '../../utils/cn'

interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

export default function StarRatingInput({ value, onChange, className }: StarRatingInputProps) {
  return (
    <div className={cn('flex items-center gap-1', className)} role="radiogroup" aria-label="Rating">
      {Array.from({ length: 5 }).map((_, index) => {
        const star = index + 1
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star <= value}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => onChange(star)}
            className="transition-transform duration-150 hover:scale-110"
          >
            <Star
              style={{ width: 30, height: 30 }}
              className={cn(
                'transition-colors',
                star <= value ? 'fill-gold-400 text-gold-400' : 'fill-night-700 text-night-700',
              )}
            />
          </button>
        )
      })}
      <span className="ml-2 text-sm font-semibold text-night-300">{value} / 5</span>
    </div>
  )
}