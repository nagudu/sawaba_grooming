import { motion } from 'framer-motion'
import { ChevronDown, Star } from 'lucide-react'
import { ButtonLink } from '../ui/Button'
import { site } from '../../data/services'

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-night-950">
      <div className="absolute inset-0">
        {/* Full photo, never cropped: object-contain always fits the ENTIRE image
            inside the hero (dark background fills any leftover space), anchored
            right so the headline sits over the dark side on wide screens. */}
        <motion.img
          src="/images/hero.jpg"
          alt="SAWABA Grooming Studio"
          className="h-full w-full object-contain object-right"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-night-950 via-night-950/70 to-night-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-transparent to-night-950/40" />
      </div>

      <div className="container-app relative pt-32 pb-24 md:pt-40">
        <div className="max-w-3xl">
          <motion.div
            className="flex items-center gap-3"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.1}
          >
            <span className="h-px w-10 bg-gold-500" />
            <p className="label-luxe">Premium Men&rsquo;s Grooming</p>
          </motion.div>

          <motion.h1
            className="mt-6 font-display text-5xl leading-[1.05] font-semibold text-night-50 sm:text-6xl lg:text-7xl"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.2}
          >
            SAWABA
            <span className="mt-2 block text-gold-gradient">
              Grooming Studio
            </span>
          </motion.h1>

          <motion.p
            className="mt-6 text-xl font-light text-night-200 sm:text-2xl"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.32}
          >
            Look Sharp. Feel Confident.
          </motion.p>

          <motion.p
            className="mt-4 max-w-xl text-base leading-relaxed text-night-400"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.42}
          >
            Precision cuts, master barbers and an experience built around
            you. Welcome to the standard of modern men&rsquo;s grooming.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-col gap-4 sm:flex-row"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.52}
          >
            <ButtonLink to="/book" variant="gold" size="lg">
              Book Appointment
            </ButtonLink>
            <ButtonLink to="/services" variant="outline" size="lg">
              View Services
            </ButtonLink>
          </motion.div>

          <motion.div
            className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.62}
          >
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 fill-gold-400 text-gold-400" />
              <div>
                <p className="text-sm font-semibold text-night-100">4.9 / 5</p>
                <p className="text-xs text-night-500">1,200+ reviews</p>
              </div>
            </div>
            <div className="hidden h-10 w-px bg-night-700 sm:block" />
            <div>
              <p className="text-sm font-semibold text-night-100">6 Master Barbers</p>
              <p className="text-xs text-night-500">Certified professionals</p>
            </div>
            <div className="hidden h-10 w-px bg-night-700 sm:block" />
            <div>
              <p className="text-sm font-semibold text-night-100">Since 2015</p>
              <p className="text-xs text-night-500">{site.address.split(',')[0]} &amp; beyond</p>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.a
        href="#about-preview"
        aria-label="Scroll down"
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-night-500 transition-colors hover:text-gold-400 md:block"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <ChevronDown className="h-6 w-6 animate-bounce" />
      </motion.a>
    </section>
  )
}