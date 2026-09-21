import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { ButtonLink } from '../ui/Button'
import { site } from '../../data/services'

const highlights = [
  'Master barbers with 5+ years experience',
  'Premium products for every finish',
  'A calm, luxurious environment',
  'Consistency you can depend on',
]

export default function AboutPreview() {
  return (
    <section id="about-preview" className="bg-night-950 py-24 md:py-32">
      <div className="container-app grid min-w-0 items-center gap-14 lg:grid-cols-2">
        <motion.div
          className="relative"
          initial={{ opacity: 0, x: -32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="grid min-w-0 grid-cols-5 gap-4">
            <motion.div
              className="col-span-3 overflow-hidden rounded-2xl border border-night-800"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <img
                src="/images/about-1.jpg"
                alt="Inside SAWABA Grooming Studio"
                className="aspect-[3/4] w-full object-cover"
                loading="lazy"
              />
            </motion.div>
            <motion.div
              className="col-span-2 flex flex-col gap-4"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="overflow-hidden rounded-2xl border border-night-800">
                <img
                  src="/images/about-2.jpg"
                  alt="Barber at work"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-night-800">
                <img
                  src="/images/about-3.jpg"
                  alt="Precision styling tools"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
          <motion.div
            className="absolute -right-4 -bottom-6 hidden items-center gap-4 rounded-2xl border border-gold-500/40 bg-night-900/90 px-6 py-5 shadow-[var(--shadow-glow)] backdrop-blur-md sm:flex"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            <span className="font-display text-5xl font-semibold text-gold-400">
              10+
            </span>
            <div className="text-sm">
              <p className="font-semibold text-night-100">Years of Craft</p>
              <p className="text-night-500">Trusted by thousands</p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="label-luxe">About SAWABA</p>
          <h2 className="mt-4 font-display text-3xl leading-tight font-semibold text-night-50 sm:text-4xl lg:text-[2.75rem]">
            Where Craft Meets
            <span className="text-gold-gradient"> Refinement</span>
          </h2>
          <p className="mt-6 leading-relaxed text-night-400">
            {site.fullName} was founded on one simple idea — that a haircut
            should be more than a routine. It should be a ritual. From the
            warm welcome to the final product application, every detail of
            your visit is designed to make you look sharp and feel confident.
          </p>
          <ul className="mt-8 space-y-4">
            {highlights.map((item, index) => (
              <motion.li
                key={item}
                className="flex items-start gap-3 text-[15px] text-night-200"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-500/50 bg-gold-500/10">
                  <Check className="h-3.5 w-3.5 text-gold-400" />
                </span>
                {item}
              </motion.li>
            ))}
          </ul>
          <div className="mt-10">
            <ButtonLink to="/about" variant="outline" size="lg">
              Learn More
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </motion.div>
      </div>
    </section>
  )
}