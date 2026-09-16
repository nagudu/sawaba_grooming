import { Link } from 'react-router-dom'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { site } from '../../data/services'
import { useCatalog } from '../../store/catalog'
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  WhatsAppIcon,
} from '../icons/SocialIcons'

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/barbers', label: 'Our Barbers' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/book', label: 'Book Appointment' },
  { to: '/payments', label: 'Payment History' },
]

export default function Footer() {
  const { services } = useCatalog()

  return (
    <footer className="border-t border-night-800 bg-night-900">
      <div className="container-app py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="lg:col-span-1.5">
            <Link to="/" className="flex items-center gap-2.5" aria-label="SAWABA home">
              <svg className="h-9 w-9" viewBox="0 0 64 64" aria-hidden="true">
                <rect width="64" height="64" rx="14" fill="#0a0a0c" />
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
              <span className="font-display text-2xl font-semibold tracking-wide text-night-50">
                {site.name}
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-night-400">
              A premium grooming destination for the modern man. Precision
              cuts, master barbers and a refined experience — every single
              visit.
            </p>
            <div className="mt-6 flex items-center gap-3">
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

          <div>
            <h4 className="label-luxe">Quick Links</h4>
            <ul className="mt-5 space-y-3">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-night-400 transition-colors hover:text-gold-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="label-luxe">Services</h4>
            <ul className="mt-5 space-y-3">
              {services.slice(0, 6).map((service) => (
                <li key={service.id}>
                  <Link
                    to={`/services/${service.id}`}
                    className="text-sm text-night-400 transition-colors hover:text-gold-400"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
              {services.length === 0 &&
                ['Normal Haircut', 'Low Cut', 'Fade'].map((name) => (
                  <li key={name}>
                    <Link
                      to="/services"
                      className="text-sm text-night-400 transition-colors hover:text-gold-400"
                    >
                      {name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h4 className="label-luxe">Get in Touch</h4>
            <ul className="mt-5 space-y-4 text-sm text-night-400">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                <span>{site.address}</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                <a href={`tel:${site.phone.replace(/\s/g, '')}`} className="transition-colors hover:text-gold-400">
                  {site.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                <a href={`mailto:${site.email}`} className="transition-colors hover:text-gold-400">
                  {site.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                <div>
                  <p>Mon – Fri: 9:00 AM – 8:00 PM</p>
                  <p>Sat: 8:00 AM – 9:00 PM</p>
                  <p>Sun: 11:00 AM – 6:00 PM</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-night-800">
        <div className="container-app flex flex-col items-center justify-between gap-3 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-night-500">
            &copy; 2026 SAWABA GROOMING SALON. All Rights Reserved.
          </p>
          <p className="text-xs text-night-600">
            Look Sharp. Feel Confident.
          </p>
        </div>
      </div>
    </footer>
  )
}