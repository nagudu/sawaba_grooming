import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Clock, Mail, MapPin, MapPinned, Phone } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import SectionTitle from '../components/ui/SectionTitle'
import ContactForm from '../components/contact/ContactForm'
import { site } from '../data/services'
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  WhatsAppIcon,
} from '../components/icons/SocialIcons'

const contactCards = [
  {
    icon: Phone,
    title: 'Phone',
    value: site.phone,
    href: `tel:${site.phone.replace(/\s/g, '')}`,
    note: 'Call us during opening hours',
  },
  {
    icon: WhatsAppIcon,
    title: 'WhatsApp',
    value: 'Chat with us instantly',
    href: `https://wa.me/${site.whatsapp}`,
    note: 'Replies within minutes',
  },
  {
    icon: Mail,
    title: 'Email',
    value: site.email,
    href: `mailto:${site.email}`,
    note: 'For bookings and enquiries',
  },
  {
    icon: MapPin,
    title: 'Visit Us',
    value: site.address,
    href: 'https://www.google.com/maps?q=Adeola+Odeku+Street,+Victoria+Island,+Lagos,+Nigeria',
    note: 'Ample parking available',
  },
]

/**
 * Google Maps embed with an offline-aware fallback: when there is no
 * internet the iframe would show a browser error, so we hide it and show
 * the address card instead. The map returns automatically when online.
 */
function OfflineMapFrame({ src }: { src: string }) {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!online) {
    return (
      <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 bg-night-900 text-center">
        <MapPinned className="h-8 w-8 text-gold-400" />
        <p className="font-display text-xl text-night-100">Find us at</p>
        <p className="max-w-xs text-sm leading-relaxed text-night-400">{site.address}</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-night-500">
          Map available when you're back online
        </p>
      </div>
    )
  }

  return (
    <iframe
      title="SAWABA Grooming Studio location map"
      src={src}
      className="h-[420px] w-full border-0 grayscale-[35%] invert-[90%] hue-rotate-180"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  )
}

export default function ContactPage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow="Contact"
        crumb="Contact"
        title="Let's Talk"
        description="Questions, bookings or feedback — we would love to hear from you. Reach out any way that suits you."
        image="/images/cta.jpg"
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app">
          <div className="grid gap-6 sm:grid-cols-2">
            {contactCards.map((card, index) => (
              <motion.a
                key={card.title}
                href={card.href}
                target={card.href.startsWith('http') ? '_blank' : undefined}
                rel={
                  card.href.startsWith('http')
                    ? 'noopener noreferrer'
                    : undefined
                }
                className="card-lux card-hover flex items-start gap-5 p-7"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold-500/30 bg-gold-500/10 text-gold-400">
                  <card.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-night-500">
                    {card.title}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold text-night-100">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-night-500">{card.note}</p>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-coal py-24 md:py-32">
        <div className="container-app">
          <div className="grid gap-14 lg:grid-cols-2">
            <div>
              <SectionTitle
                align="left"
                eyebrow="Contact Form"
                title="Send Us a Message"
                description="Fill in the form and our team will get back to you — usually within a few hours."
              />
              <div className="mt-8">
                <div className="card-lux p-7">
                  <h4 className="label-luxe">Opening Hours</h4>
                  <ul className="mt-5 space-y-3">
                    {site.hours.map((entry) => (
                      <li
                        key={entry.day}
                        className="flex items-center justify-between border-b border-night-800 pb-3 text-sm"
                      >
                        <span className="text-night-300">{entry.day}</span>
                        <span className="flex items-center gap-2 text-night-400">
                          <Clock className="h-3.5 w-3.5 text-gold-500" />
                          {entry.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-night-500">
                      Follow Us
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      {[
                        { href: site.instagram, label: 'Instagram', Icon: InstagramIcon },
                        { href: site.facebook, label: 'Facebook', Icon: FacebookIcon },
                        { href: site.twitter, label: 'Twitter / X', Icon: TwitterIcon },
                        { href: `https://wa.me/${site.whatsapp}`, label: 'WhatsApp', Icon: WhatsAppIcon },
                      ].map(({ href, label, Icon }) => (
                        <a
                          key={label}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={label}
                          className="rounded-lg border border-night-700 p-2.5 text-night-400 transition-all duration-300 hover:border-gold-500 hover:text-gold-400"
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ContactForm />
          </div>
        </div>
      </section>

      <section className="bg-night-950 py-24">
        <div className="container-app">
          <SectionTitle
            eyebrow="Find Us"
            title="We Are Easy to Get To"
            description="Right in Unguwa Uku, Sabuwar Abuja, Kano — easy to reach from anywhere in the city."
          />
          <motion.div
            className="mt-12 overflow-hidden rounded-2xl border border-night-800"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <OfflineMapFrame src={site.mapEmbedUrl} />
          </motion.div>
        </div>
      </section>
    </PageTransition>
  )
}