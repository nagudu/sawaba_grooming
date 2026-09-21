import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
interface PageHeroProps {
  eyebrow: string
  title: string
  description?: string
  /** Local image path (e.g. /images/pagehero.jpg) — never an external URL. */
  image?: string
  crumb: string
}

export default function PageHero({
  eyebrow,
  title,
  description,
  image = '/images/pagehero.jpg',
  crumb,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-night-950 pt-[72px]">
      <div className="absolute inset-0">
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-105 object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-night-950/70 via-night-950/85 to-night-950" />
      </div>

      <div className="container-app relative py-24 md:py-32">
        <motion.nav
          aria-label="Breadcrumb"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-night-500"
        >
          <Link to="/" className="transition-colors hover:text-gold-400">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gold-400">{crumb}</span>
        </motion.nav>

        <motion.p
          className="label-luxe"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          className="mt-4 max-w-3xl text-4xl leading-tight font-semibold text-night-50 sm:text-5xl lg:text-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16 }}
        >
          {title}
        </motion.h1>
        {description && (
          <motion.p
            className="mt-6 max-w-2xl text-base leading-relaxed text-night-400 md:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
          >
            {description}
          </motion.p>
        )}
      </div>
    </section>
  )
}