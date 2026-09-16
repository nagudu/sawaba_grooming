import { Quote } from 'lucide-react'
import type { Testimonial } from '../../types'
import SmartImage from '../ui/SmartImage'
import StarRating from '../ui/StarRating'

interface TestimonialCardProps {
  testimonial: Testimonial
}

export default function TestimonialCard({
  testimonial,
}: TestimonialCardProps) {
  return (
    <figure className="card-lux card-hover flex h-full flex-col p-7">
      <Quote className="h-8 w-8 text-gold-500/30" aria-hidden="true" />
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-night-300">
        &ldquo;{testimonial.text}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-4 border-t border-night-800 pt-5">
        {testimonial.image ? (
          <SmartImage
            src={testimonial.image}
            alt={testimonial.name}
            className="h-12 w-12 rounded-full border border-night-700"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-night-900 text-sm font-bold text-gold-400">
            {testimonial.name.charAt(0)}
          </span>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-night-100">
            {testimonial.name}
          </p>
          {testimonial.service && (
            <p className="text-xs text-gold-500">{testimonial.service}</p>
          )}
          {testimonial.date && (
            <p className="mt-0.5 text-[11px] text-night-500">
              {new Date(testimonial.date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <StarRating rating={testimonial.rating} />
      </figcaption>
    </figure>
  )
}