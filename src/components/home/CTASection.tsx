import { motion } from 'framer-motion'
import { ButtonLink } from '../ui/Button'

export default function CTASection() {
  return (
    <section className="relative overflow-hidden bg-night-950 py-16 md:py-20">
      <div className="absolute inset-0">
        <img
          src="/images/cta.jpg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-night-950 via-night-950/80 to-night-950" />
      </div>

      <motion.div
        className="container-app relative text-center"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="label-luxe">Your Time. Your Look.</p>
        <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl leading-tight font-semibold text-night-50 sm:text-5xl">
          Ready for Your
          <span className="text-gold-gradient"> Next Look?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-night-400">
          Book your appointment in under two minutes. Walk in sharp. Walk out
          unforgettable.
        </p>
        <div className="mt-10">
          <ButtonLink to="/book" variant="gold" size="lg">
            Book Your Appointment
          </ButtonLink>
        </div>
      </motion.div>
    </section>
  )
}