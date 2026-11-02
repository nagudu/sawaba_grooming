import type { MouseEvent } from 'react'

export interface NavLinkItem {
  to: string
  label: string
}

/** Always visible on desktop. */
export const PRIMARY_LINKS: NavLinkItem[] = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/barbers', label: 'Barbers' },
  { to: '/shop', label: 'Shop' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
]

/** Grouped under "More" between lg and xl, inline from xl upwards. */
export const SECONDARY_LINKS: NavLinkItem[] = [
  { to: '/about', label: 'About' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/track', label: 'Track Order' },
]

export const ALL_LINKS: NavLinkItem[] = [...PRIMARY_LINKS, ...SECONDARY_LINKS]

/** On /book, scroll to the booking form instead of reloading the route. */
export function handleBookClick(event: MouseEvent<HTMLAnchorElement>): void {
  if (window.location.pathname !== '/book') return
  const target = document.getElementById('booking-form')
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
