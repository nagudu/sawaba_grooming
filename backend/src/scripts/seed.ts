import { sequelize } from '../config/database'
import { Barber, BarberAvailability, Service } from '../models'
import { getPaymentSettingsRecord } from '../services/paymentSettingsService'

const img = (photoId: string, w = 900, q = 80): string =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${w}&q=${q}`

interface ServiceSeed {
  name: string
  slug: string
  category: string
  description: string
  price: number
  duration: number
  image: string
}

const serviceSeeds: ServiceSeed[] = [
  {
    name: 'Normal Haircut',
    slug: 'normal-haircut',
    category: 'HAIRCUTS',
    description:
      'A precise, classic haircut tailored to your face shape and lifestyle. Includes consultation, wash, cut and a crisp finish.',
    price: 5000,
    duration: 30,
    image: img('1703792684940-a05aa0f1188f'),
  },
  {
    name: 'Low Cut',
    slug: 'low-cut',
    category: 'HAIRCUTS',
    description:
      'A uniform, low-maintenance cut with crisp edges for a clean, confident everyday look.',
    price: 5500,
    duration: 30,
    image: img('1653758265969-b048bb0b328a'),
  },
  {
    name: 'Fade',
    slug: 'fade',
    category: 'HAIRCUTS',
    description:
      'A seamless fade from skin to longer length on top, cut and blended by a specialist for maximum impact.',
    price: 7000,
    duration: 45,
    image: img('1717089256239-dc2ed4d9dfc6'),
  },
  {
    name: 'Skin Fade',
    slug: 'skin-fade',
    category: 'HAIRCUTS',
    description:
      'A dramatic skin-level fade for a bold, statement look that demands attention.',
    price: 8000,
    duration: 45,
    image: img('1512864084360-7c0c4d0a0845'),
  },
  {
    name: 'Beard Trim',
    slug: 'beard-trim',
    category: 'BEARDS',
    description:
      'Precision beard shaping, trimming and conditioning to keep your beard sharp and healthy.',
    price: 4500,
    duration: 25,
    image: img('1643899552181-6035a1e0872c'),
  },
  {
    name: 'Beard Styling',
    slug: 'beard-styling',
    category: 'BEARDS',
    description:
      'Complete beard sculpting and styling service with hot towel, brush work and finishing products.',
    price: 6000,
    duration: 35,
    image: img('1686671805337-7d8aa64b965f'),
  },
  {
    name: 'Haircut & Beard',
    slug: 'haircut-and-beard',
    category: 'GROOMING',
    description:
      'Our most popular combo — a precision haircut paired with a full beard trim for one complete look.',
    price: 11000,
    duration: 60,
    image: img('1737495194047-5e353ea3e6d9'),
  },
  {
    name: 'Hair Washing',
    slug: 'hair-washing',
    category: 'TREATMENTS',
    description:
      'A thorough, relaxing wash with premium products that cleanses, refreshes and preps the scalp.',
    price: 3000,
    duration: 15,
    image: img('1567894340315-735d7c361db0'),
  },
  {
    name: 'Hair Treatment',
    slug: 'hair-treatment',
    category: 'TREATMENTS',
    description:
      'Deep conditioning and scalp treatment to restore health, strength and shine to your hair.',
    price: 9000,
    duration: 40,
    image: img('1605980776566-0486c3ac7617'),
  },
  {
    name: 'Facial Treatment',
    slug: 'facial-treatment',
    category: 'TREATMENTS',
    description:
      'A deep-cleansing facial that brightens, exfoliates and refreshes the skin — designed for men.',
    price: 12000,
    duration: 45,
    image: img('1584119164246-461d43e9bab3'),
  },
  {
    name: 'Kids Haircut',
    slug: 'kids-haircut',
    category: 'KIDS',
    description:
      'Patient, friendly haircuts for kids in a relaxed environment — with extra care for first-timers.',
    price: 4000,
    duration: 25,
    image: img('1522529599102-193c0d76b5b6'),
  },
  {
    name: 'VIP Grooming',
    slug: 'vip-grooming',
    category: 'GROOMING',
    description:
      'A complete head-to-toe grooming experience — private suite, full styling, facial, hair treatment and refreshments.',
    price: 30000,
    duration: 120,
    image: img('1560250097-0b93528c311a'),
  },
]

interface BarberSeed {
  name: string
  slug: string
  specialty: string
  experience: number
  rating: number
  biography: string
  image: string
  serviceSlugs: string[]
}

const barberSeeds: BarberSeed[] = [
  {
    name: 'Aminu Sawaba',
    slug: 'aminu-sawaba',
    specialty: 'Master Barber & Founder',
    experience: 15,
    rating: 5.0,
    biography:
      'Founder of SAWABA, Aminu has built a reputation for precision fades and the art of the tailor-made cut.',
    image: img('1596580817363-a4a8f67d4bc8'),
    serviceSlugs: ['normal-haircut', 'fade', 'skin-fade', 'haircut-and-beard', 'vip-grooming'],
  },
  {
    name: 'Tunde Adeyemi',
    slug: 'tunde-adeyemi',
    specialty: 'Fade Specialist',
    experience: 9,
    rating: 4.9,
    biography:
      'Known for razor-sharp fades and a steady hand, Tunde is a client favourite for modern, bold cuts.',
    image: img('1587064712555-6e206484699b'),
    serviceSlugs: ['fade', 'skin-fade', 'low-cut', 'normal-haircut'],
  },
  {
    name: 'Emeka Okafor',
    slug: 'emeka-okafor',
    specialty: 'Beard & Skin Fade Expert',
    experience: 8,
    rating: 4.9,
    biography:
      'Emeka sculpts beards and skin fades with surgical precision — the go-to for a statement look.',
    image: img('1605980776566-0486c3ac7617'),
    serviceSlugs: ['beard-trim', 'beard-styling', 'skin-fade', 'haircut-and-beard'],
  },
  {
    name: 'David Mensah',
    slug: 'david-mensah',
    specialty: 'Classic & Executive Cuts',
    experience: 12,
    rating: 4.8,
    biography:
      'David brings timeless, executive styling for the modern professional — sharp, measured, elegant.',
    image: img('1584119164246-461d43e9bab3'),
    serviceSlugs: ['normal-haircut', 'low-cut', 'haircut-and-beard', 'beard-trim'],
  },
  {
    name: 'Ibrahim Danladi',
    slug: 'ibrahim-danladi',
    specialty: 'Precision & Texture Specialist',
    experience: 6,
    rating: 4.7,
    biography:
      'A rising star, Ibrahim blends texture with precision to create cuts with natural movement.',
    image: img('1606459431839-90b942dc3754'),
    serviceSlugs: ['fade', 'low-cut', 'normal-haircut', 'hair-washing'],
  },
  {
    name: 'Kingsley Uche',
    slug: 'kingsley-uche',
    specialty: 'Kids & Family Cuts',
    experience: 5,
    rating: 4.8,
    biography:
      'Calm, patient and brilliant with kids — Kingsley makes family visits a pleasure.',
    image: img('1524660988542-c440de9c0fde'),
    serviceSlugs: ['kids-haircut', 'low-cut', 'skin-fade', 'normal-haircut'],
  },
]

const weeklySchedule: Record<number, [string, string]> = {
  0: ['11:00', '18:00'],
  1: ['09:00', '20:00'],
  2: ['09:00', '20:00'],
  3: ['09:00', '20:00'],
  4: ['09:00', '20:00'],
  5: ['09:00', '21:00'],
  6: ['08:00', '21:00'],
}

async function run(): Promise<void> {
  await sequelize.authenticate()
  console.log('[db:seed] database connection established')

  const serviceBySlug: Record<string, number> = {}
  for (const seed of serviceSeeds) {
    const [service, created] = await Service.findOrCreate({
      where: { slug: seed.slug },
      defaults: {
        name: seed.name,
        slug: seed.slug,
        category: seed.category,
        description: seed.description,
        price: seed.price,
        duration: seed.duration,
        image: seed.image,
        isActive: true,
      },
    })
    serviceBySlug[seed.slug] = service.id
    console.log(
      created
        ? `[db:seed] created service: ${service.name}`
        : `[db:seed] service already exists: ${service.name}`,
    )
  }

  for (const seed of barberSeeds) {
    const [barber, created] = await Barber.findOrCreate({
      where: { slug: seed.slug },
      defaults: {
        name: seed.name,
        slug: seed.slug,
        specialty: seed.specialty,
        biography: seed.biography,
        experience: seed.experience,
        rating: seed.rating,
        image: seed.image,
        isActive: true,
      },
    })

    const serviceIds = serviceSeeds
      .map((serviceSeed) => serviceBySlug[serviceSeed.slug])
      .filter((id): id is number => Boolean(id))
    await barber.setServices(serviceIds)
    console.log(
      created
        ? `[db:seed] created barber: ${barber.name} (${serviceIds.length} services)`
        : `[db:seed] reconciled barber services: ${barber.name} (${serviceIds.length} services)`,
    )

    for (const [day, [startTime, endTime]] of Object.entries(weeklySchedule)) {
      await BarberAvailability.upsert({
        barberId: barber.id,
        dayOfWeek: Number(day),
        startTime,
        endTime,
        isAvailable: true,
      })
    }
  }
  console.log('[db:seed] availability schedules upserted')

  await getPaymentSettingsRecord()
  console.log('[db:seed] default payment settings ensured')

  await sequelize.close()
  console.log('[db:seed] done')
}

run().catch(async (error) => {
  console.error('[db:seed] failed:', error)
  await sequelize.close()
  process.exitCode = 1
})

export {};