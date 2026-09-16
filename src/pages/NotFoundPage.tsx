import { motion } from 'framer-motion'
import { Home, Scissors } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import { ButtonLink } from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <PageTransition>
      <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden bg-night-950 px-6 pt-[72px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,162,75,0.08),transparent_60%)]" />

        <div className="relative text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center"
          >
            <p className="text-outline font-display text-[9rem] leading-none sm:text-[12rem]">
              404
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-gold-500/10">
              <Scissors className="h-6 w-6 text-gold-400" />
            </span>
            <h1 className="mt-6 font-display text-3xl text-night-50 sm:text-4xl">
              This Page Was a Bad Cut
            </h1>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-night-400">
              The page you are looking for doesn&rsquo;t exist. Let us get you
              back to a sharp look.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink to="/" variant="gold" size="md">
                <Home className="h-4 w-4" />
                Back to Home
              </ButtonLink>
              <ButtonLink to="/book" variant="outline" size="md">
                Book Appointment
              </ButtonLink>
            </div>
          </motion.div>
        </div>
      </section>
    </PageTransition>
  )
}