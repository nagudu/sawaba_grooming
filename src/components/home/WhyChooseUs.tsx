import { motion } from 'framer-motion'
import {
  Award,
  Scissors,
  ShieldCheck,
  Sofa,
  Sparkles,
  ThumbsUp,
} from 'lucide-react'
import SectionTitle from '../ui/SectionTitle'

const features = [
  {
    icon: Scissors,
    title: 'Professional Barbers',
    text: 'Certified, experienced barbers who treat every cut as a craft.',
  },
  {
    icon: Sparkles,
    title: 'Premium Service',
    text: 'Hot towels, quality products and finishing touches on every visit.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Grooming',
    text: 'Consistent, hygienic and meticulous attention to detail.',
  },
  {
    icon: Sofa,
    title: 'Comfortable Environment',
    text: 'A calm, refined space designed for you to unwind.',
  },
  {
    icon: ThumbsUp,
    title: 'Customer Satisfaction',
    text: 'We are not done until you walk out feeling your best.',
  },
  {
    icon: Award,
    title: 'Award-Winning Team',
    text: 'Recognised across the industry for excellence and craftsmanship.',
  },
]

export default function WhyChooseUs() {
  return (
    <section className="bg-night-900 py-24 md:py-32">
      <div className="container-app">
        <SectionTitle
          eyebrow="Why Choose SAWABA"
          title="The Difference Is in the Detail"
          description="More than a haircut — a standard. Here is what sets SAWABA apart from the rest."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="card-lux card-hover p-8"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: (index % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-gold-500/30 bg-gold-500/10">
                <feature.icon className="h-6 w-6 text-gold-400" />
              </span>
              <h3 className="mt-6 font-display text-xl text-night-50">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-night-400">
                {feature.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}