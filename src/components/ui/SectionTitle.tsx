import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'

interface SectionTitleProps {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
  className?: string
  light?: boolean
}

export default function SectionTitle({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: SectionTitleProps) {
  const centered = align === 'center'
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn('max-w-2xl', centered && 'mx-auto text-center', className)}
    >
      <p className="label-luxe">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold leading-tight text-night-50 sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-base leading-relaxed text-night-400">
          {description}
        </p>
      )}
    </motion.div>
  )
}