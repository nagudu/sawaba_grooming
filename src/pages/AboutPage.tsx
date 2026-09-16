import { motion } from 'framer-motion'
import {
  Award,
  Eye,
  Gem,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import SectionTitle from '../components/ui/SectionTitle'
import { ButtonLink } from '../components/ui/Button'
import { unsplash } from '../utils/format'
import { site } from '../data/services'

const values = [
  {
    icon: ShieldCheck,
    title: 'Professionalism',
    text: 'Every haircut, every interaction — held to the highest standard, every single time.',
  },
  {
    icon: Gem,
    title: 'Quality',
    text: 'Premium products and meticulous techniques that show in the final finish.',
  },
  {
    icon: HeartHandshake,
    title: 'Respect',
    text: 'We listen first. Your time, your preferences and your comfort matter.',
  },
  {
    icon: Sparkles,
    title: 'Customer Satisfaction',
    text: 'We measure success by one thing: how confident you feel when you leave.',
  },
  {
    icon: Award,
    title: 'Excellence',
    text: 'We never stop sharpening our skills. The craft always comes first.',
  },
]

const advantages = [
  'Walk-in friendly when slots are open',
  'Premium products included in every service',
  'Consistent barber continuity — book your favourite',
  'Hygienic practices and sanitised tools on every client',
  'Comfortable lounge, refreshments and cold AC',
  'Transparent pricing with no hidden extras',
]

export default function AboutPage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow="About Us"
        crumb="About Us"
        title="The Art of Looking Sharp"
        description="SAWABA is more than a barbershop. It is a grooming house built on craft, respect and an uncompromising eye for detail."
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="label-luxe">Our Story</p>
              <h2 className="mt-4 font-display text-3xl leading-tight font-semibold text-night-50 sm:text-4xl">
                Built on Craft, Run on{' '}
                <span className="text-gold-gradient">Respect</span>
              </h2>
              <p className="mt-6 leading-relaxed text-night-400">
                {site.fullName} began in 2015 as a single chair and a simple
                promise: every man who sits down leaves looking and feeling his
                best. From those first days, founder Aminu Sawaba insisted on
                the details — clean tools, honest advice, and a cut that fits
                the person, not the trend.
              </p>
              <p className="mt-4 leading-relaxed text-night-400">
                Today, the salon has grown into one of the most trusted
                grooming destinations in the city. A place where professionals,
                creatives and fathers all find the same thing: consistency,
                craft and a welcome that feels like home.
              </p>
              <p className="mt-4 leading-relaxed text-night-400">
                We still do it the way we always have. One careful cut at a
                time.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={unsplash('1737495194047-5e353ea3e6d9', 700, 80)}
                alt="Inside SAWABA salon"
                className="aspect-[3/4] w-full rounded-2xl border border-night-800 object-cover"
                loading="lazy"
              />
              <img
                src={unsplash('1531384441138-2736e62e0919', 700, 80)}
                alt="Barber styling client"
                className="mt-10 aspect-[3/4] w-full rounded-2xl border border-night-800 object-cover"
                loading="lazy"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-coal py-24 md:py-32">
        <div className="container-app">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              className="card-lux card-hover relative overflow-hidden p-8 md:p-10"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Target className="h-8 w-8 text-gold-400" />
              <h3 className="mt-5 font-display text-2xl text-night-50">
                Our Mission
              </h3>
              <p className="mt-4 leading-relaxed text-night-400">
                To give every client a premium grooming experience that blends
                skill, style and genuine care — so that looking sharp becomes
                effortless, and confidence becomes second nature.
              </p>
            </motion.div>
            <motion.div
              className="card-lux card-hover relative overflow-hidden p-8 md:p-10"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Eye className="h-8 w-8 text-gold-400" />
              <h3 className="mt-5 font-display text-2xl text-night-50">
                Our Vision
              </h3>
              <p className="mt-4 leading-relaxed text-night-400">
                To be the most trusted name in men&rsquo;s grooming — the place
                where craft meets character, setting the standard for what a
                modern barber experience should feel like.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app">
          <SectionTitle
            eyebrow="Our Values"
            title="What We Stand For"
            description="Five principles guide everything we do in the chair and beyond."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                className="card-lux card-hover p-8"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: (index % 3) * 0.1 }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold-500/30 bg-gold-500/10">
                  <value.icon className="h-5 w-5 text-gold-400" />
                </span>
                <h3 className="mt-5 font-display text-xl text-night-50">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-night-400">
                  {value.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-coal py-24 md:py-32">
        <div className="container-app">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="label-luxe">Why Choose SAWABA</p>
              <h2 className="mt-4 font-display text-3xl leading-tight font-semibold text-night-50 sm:text-4xl">
                An Edge That
                <span className="text-gold-gradient"> Lasts</span>
              </h2>
              <ul className="mt-8 space-y-4">
                {advantages.map((advantage, index) => (
                  <motion.li
                    key={advantage}
                    className="flex items-start gap-3 border-b border-night-800 pb-4 text-[15px] text-night-200"
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold-500" />
                    {advantage}
                  </motion.li>
                ))}
              </ul>
              <div className="mt-10">
                <ButtonLink to="/book" variant="gold" size="lg">
                  Book Your Visit
                </ButtonLink>
              </div>
            </motion.div>

            <motion.div
              className="overflow-hidden rounded-2xl border border-night-800"
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={unsplash('1560250097-0b93528c311a', 1000, 80)}
                alt="The SAWABA experience"
                className="w-full object-cover"
                loading="lazy"
              />
            </motion.div>
          </div>
        </div>
      </section>
    </PageTransition>
  )
}