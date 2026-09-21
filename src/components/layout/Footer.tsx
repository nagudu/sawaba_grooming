import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  Mail,
  MapPin,
  Phone,
  Scissors,
} from 'lucide-react'
import { site } from '../../data/services'
import { useCatalog } from '../../store/catalog'
import { ButtonLink } from '../ui/Button'
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  WhatsAppIcon,
} from '../icons/SocialIcons'

const exploreLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/barbers', label: 'Our Barbers' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
]

const hours = [
  { label: 'Mon – Thu', time: '9:00 AM – 8:00 PM' },
  { label: 'Friday', time: '9:00 AM – 9:00 PM' },
  { label: 'Saturday', time: '8:00 AM – 9:00 PM' },
  { label: 'Sunday', time: '11:00 AM – 6:00 PM' },
]

const socials = [
  { href: site.instagram, label: 'Instagram', Icon: InstagramIcon },
  { href: site.facebook, label: 'Facebook', Icon: FacebookIcon },
  { href: site.twitter, label: 'Twitter / X', Icon: TwitterIcon },
  { href: `https://wa.me/${site.whatsapp}`, label: 'WhatsApp', Icon: WhatsAppIcon },
]

function Logo() {
  return (
    <svg className="h-11 w-11 shrink-0" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0d0d10" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="15.25"
        fill="none"
        stroke="#c9a24b"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <g
        fill="none"
        stroke="#c9a24b"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="24" cy="30" r="9" />
        <path d="M30 24 L44 12" />
        <path d="M34 24 L50 12" />
        <path d="M24 39 L24 52" />
      </g>
      <circle cx="44" cy="20" r="1.6" fill="#c9a24b" />
    </svg>
  )
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-500">
        {children}
      </h4>
      <span className="mt-3 block h-px w-9 bg-gradient-to-r from-gold-500/80 to-transparent" />
    </div>
  )
}

export default function Footer() {
  const { services } = useCatalog()

  const serviceLinks = services.slice(0, 6)
  const fallbackServices = ['Normal Haircut', 'Low Cut', 'Fade']

  return (
    <footer className="relative overflow-hidden border-t border-night-800/80 bg-night-950">
      {/* Ambient premium glow — faint gold radiance, never loud */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(201,162,75,0.08),transparent_65%)]" />
        <div className="absolute inset-y-0 right-0 w-[420px] bg-[radial-gradient(70%_70%_at_100%_100%,rgba(201,162,75,0.05),transparent_70%)]" />
      </div>

      {/* ── Call to action band ─────────────────────────────────────────── */}
      <div className="relative border-b border-night-800/70">
        <div className="container-app flex flex-col items-start justify-between gap-8 py-12 md:flex-row md:items-center md:py-14">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-500">
              The Premier Grooming Studio
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold leading-tight text-night-50 sm:text-4xl">
              Ready to look your{' '}
              <span className="text-gold-400">sharpest?</span>
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-night-400">
              Reserve your chair in seconds — precision cuts, expert styling
              and a refined experience, every single visit.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink to="/book" variant="gold" size="lg" className="w-full sm:w-auto">
              Book an Appointment
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink to="/services" variant="outline" size="lg" className="w-full sm:w-auto">
              Explore Services
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* ── Main footer grid ────────────────────────────────────────────── */}
      <div className="container-app relative pb-12 pt-16 md:pt-20">
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-2 lg:col-span-4">
            <Link
              to="/"
              aria-label={`${site.fullName} home`}
              className="inline-flex items-center gap-3"
            >
              <Logo />
              <span className="font-display text-2xl font-semibold tracking-[0.08em] text-night-50">
                {site.name}
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-night-400">
              {site.tagline} — a premium grooming destination for the modern
              man. Master barbers, precise cuts and a space designed around
              your look.
            </p>

            <div className="mt-7 flex items-center gap-3">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-night-700/80 text-night-400 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-500/70 hover:bg-gold-500/10 hover:text-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>

            <p className="mt-7 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-night-500">
              <Scissors className="h-3.5 w-3.5 text-gold-500" />
              Certified master barbers
            </p>
          </div>

          {/* Explore */}
          <div className="lg:col-span-3">
            <ColumnHeading>Explore</ColumnHeading>
            <ul className="space-y-3.5">
              {exploreLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center gap-2 text-sm text-night-400 transition-colors duration-200 hover:text-gold-300"
                  >
                    <ArrowRight className="h-3 w-3 -translate-x-1 text-gold-500/0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-gold-500" />
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                      {link.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className="lg:col-span-2">
            <ColumnHeading>Services</ColumnHeading>
            <ul className="space-y-3.5">
              {serviceLinks.map((service) => (
                <li key={service.id}>
                  <Link
                    to={`/services/${service.id}`}
                    className="text-sm text-night-400 transition-colors duration-200 hover:text-gold-300"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
              {serviceLinks.length === 0 &&
                fallbackServices.map((name) => (
                  <li key={name}>
                    <Link
                      to="/services"
                      className="text-sm text-night-400 transition-colors duration-200 hover:text-gold-300"
                    >
                      {name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {/* Visit us */}
          <div className="md:col-span-2 lg:col-span-3">
            <ColumnHeading>Visit Us</ColumnHeading>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-night-800 bg-night-900/80 text-gold-500">
                  <MapPin className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-night-500">
                    Location
                  </span>
                  <span className="mt-0.5 block text-night-300">{site.address}</span>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(site.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block text-xs font-medium text-gold-500 transition-colors hover:text-gold-300"
                  >
                    Get directions
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-night-800 bg-night-900/80 text-gold-500">
                  <Phone className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-night-500">
                    Call us
                  </span>
                  <a
                    href={`tel:${site.phone.replace(/\s/g, '')}`}
                    className="mt-0.5 block text-night-300 transition-colors hover:text-gold-300"
                  >
                    {site.phone}
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-night-800 bg-night-900/80 text-gold-500">
                  <Mail className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-night-500">
                    Email
                  </span>
                  <a
                    href={`mailto:${site.email}`}
                    className="mt-0.5 block text-night-300 transition-colors hover:text-gold-300"
                  >
                    {site.email}
                  </a>
                </span>
              </li>
            </ul>

            <div className="mt-6 rounded-xl border border-night-800/80 bg-night-900/60 p-4">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-night-400">
                <Clock className="h-3.5 w-3.5 text-gold-500" />
                Opening hours
              </span>
              <dl className="mt-3 space-y-1.5">
                {hours.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <dt className="text-xs text-night-500">{row.label}</dt>
                    <dd className="text-xs text-night-200">{row.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────── */}
      <div className="relative border-t border-night-800/70">
        <div className="container-app flex flex-col items-center justify-between gap-2.5 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-night-500">
            &copy; 2026 {site.fullName}. All rights reserved.
          </p>
          <p className="text-xs text-night-400">
            Developed by <span className="font-medium text-night-200">Halifan Nagudu</span>
          </p>
          <p className="text-xs tracking-[0.14em] text-night-500">
            Look Sharp. <span className="font-semibold text-gold-500">Feel Confident.</span>
          </p>
        </div>
      </div>
    </footer>
  )
}