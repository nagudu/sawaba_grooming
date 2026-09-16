/**
 * Static business identity for SAWABA Grooming Salon (contact info, hours,
 * socials). Catalog content (services, barbers, gallery) now comes from the
 * backend — see src/api/catalog.ts and src/store/catalog.tsx.
 */
export const site = {
  name: 'SAWABA',
  fullName: 'SAWABA GROOMING SALON',
  tagline: 'Look Sharp. Feel Confident.',
  phone: '+234 706 928 8456',
  whatsapp: '2347069288456',
  email: 'hello@sawabasalon.com',
  address: 'Unguwa Uku, Sabuwar Abuja, Kano, Nigeria',
  instagram: 'https://instagram.com/sawabasalon',
  facebook: 'https://facebook.com/sawabasalon',
  twitter: 'https://x.com/sawabasalon',
  hours: [
    { day: 'Monday', time: '9:00 AM – 8:00 PM' },
    { day: 'Tuesday', time: '9:00 AM – 8:00 PM' },
    { day: 'Wednesday', time: '9:00 AM – 8:00 PM' },
    { day: 'Thursday', time: '9:00 AM – 8:00 PM' },
    { day: 'Friday', time: '9:00 AM – 9:00 PM' },
    { day: 'Saturday', time: '8:00 AM – 9:00 PM' },
    { day: 'Sunday', time: '11:00 AM – 6:00 PM' },
  ],
  mapEmbedUrl:
    'https://www.google.com/maps?q=Unguwa+Uku,+Kano,+Nigeria&output=embed',
}
