import { Star } from 'lucide-react'
import { cn } from '../../utils/cn'

interface StarRatingProps {
  rating: number
  className?: string
  size?: number
}

export default function StarRating({
  rating,
  className,
  size = 14,
}: StarRatingProps) {
  const rounded = Math.round(rating)
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      aria-label={`${rating} out of 5 stars`}
      role="img"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          style={{ width: size, height: size }}
          className={
            index < rounded
              ? 'fill-gold-400 text-gold-400'
              : 'fill-night-700 text-night-700'
          }
        />
      ))}
    </div>
  )
}