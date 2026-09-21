import { Op, fn, col } from 'sequelize'
import { Barber, BarberAvailability, BarberService, Review, Service, Appointment } from '../models'
import { NotFoundError } from '../utils/errors'
import { getPagination } from '../utils/response'
import { slugify } from '../utils/slug'
import type { CreateBarberInput, UpdateBarberInput } from '../validators/barber'
import type { Paged } from '../types'

export interface BarberPublic {
  id: number
  name: string
  slug: string
  image: string | null
  phone: string | null
  email: string | null
  specialty: string | null
  biography: string | null
  experience: number
  rating: number
  reviewCount?: number
  reviewAverage?: number
  isActive: boolean
  appointmentCount?: number
  createdAt: Date
  updatedAt: Date
  services?: Array<{ id: number; name: string; slug: string; price: number; duration: number }>
}

/** Admin-only business fields (requirement #16/#23) — never serialized publicly. */
export interface BarberAdmin extends BarberPublic {
  barberType: 'INTERNAL' | 'EXTERNAL'
  location: string | null
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
}

/**
 * Public serializer — deliberately OMITS barberType, location, commissionType
 * and commissionValue. Customers see the barber, not the business terms.
 */
export function serializeBarber(
  barber: Barber,
  includeServices = false,
): BarberPublic {
  const base: BarberPublic = {
    id: barber.id,
    name: barber.name,
    slug: barber.slug,
    image: barber.image,
    phone: barber.phone,
    email: barber.email,
    specialty: barber.specialty,
    biography: barber.biography,
    experience: barber.experience,
    rating: Number(barber.rating),
    isActive: barber.isActive,
    createdAt: barber.createdAt,
    updatedAt: barber.updatedAt,
  }

  if (includeServices && barber.services) {
    base.services = barber.services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      price: Number(service.price),
      duration: service.duration,
    }))
  }

  return base
}

/** Admin serializer — public fields plus the internal business classification. */
export function serializeBarberForAdmin(
  barber: Barber,
  includeServices = false,
): BarberAdmin {
  const base = serializeBarber(barber, includeServices) as BarberAdmin
  base.barberType = barber.barberType ?? 'INTERNAL'
  base.location = barber.location ?? null
  base.commissionType = barber.commissionType ?? 'PERCENTAGE'
  base.commissionValue = Number(barber.commissionValue ?? 0)
  return base
}

const serviceScope = {
  include: [
    {
      model: Service,
      as: 'services',
      through: { attributes: [] },
    },
  ],
}

/**
 * Attaches real approved-review counts and averages to serialized barbers.
 * Counts come from the `barberId` column on reviews — never fabricated, so a
 * barber with no linked reviews shows 0 rather than a seeded placeholder.
 */
async function attachReviewStats(items: BarberPublic[]): Promise<void> {
  if (items.length === 0) return
  const rows = await Review.findAll({
    attributes: [
      'barberId',
      [fn('COUNT', col('Review.id')), 'count'],
      [fn('AVG', col('Review.rating')), 'average'],
    ],
    where: { status: 'APPROVED', barberId: { [Op.in]: items.map((item) => item.id) } },
    group: ['barberId'],
    raw: true,
  })
  const stats = new Map(
    (rows as unknown as Array<{ barberId: number; count: string | number; average: string | number }>).map(
      (row) => [Number(row.barberId), row],
    ),
  )
  for (const item of items) {
    const row = stats.get(item.id)
    item.reviewCount = row ? Number(row.count) : 0
    item.reviewAverage = row ? Math.round(Number(row.average) * 10) / 10 : 0
  }
}

async function uniqueSlug(name: string, excludeId?: number): Promise<string> {
  const base = slugify(name)
  let candidate = base
  let counter = 2

  while (true) {
    const existing = await Barber.findOne({
      where: excludeId
        ? { slug: candidate, id: { [Op.not]: excludeId } }
        : { slug: candidate },
    })
    if (!existing) return candidate
    candidate = `${base}-${counter}`
    counter += 1
  }
}

export async function createBarber(input: CreateBarberInput): Promise<BarberAdmin> {
  const { serviceIds, ...data } = input
  const slug = await uniqueSlug(data.name)
  const barber = await Barber.create({ ...data, slug })

  if (serviceIds && serviceIds.length > 0) {
    await barber.setServices(serviceIds)
  }

  return getBarberByIdForAdmin(barber.id)
}

export async function listBarbers(
  query: {
    serviceId?: number
    isActive?: string
    includeInactive?: string
    search?: string
    barberType?: string
    location?: string
    page?: number
    perPage?: number
  },
  options: { adminView?: boolean } = {},
): Promise<Paged<BarberPublic>> {
  const { page, perPage, offset, limit } = getPagination(query as Record<string, unknown>)
  const includeInactive = query.includeInactive === 'true'

  const where = {
    ...(!includeInactive
      ? { isActive: true }
      : query.isActive
        ? { isActive: query.isActive === 'true' }
        : {}),
    ...(query.search
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${query.search}%` } },
            { slug: { [Op.like]: `%${query.search}%` } },
            { specialty: { [Op.like]: `%${query.search}%` } },
            { biography: { [Op.like]: `%${query.search}%` } },
          ],
        }
      : {}),
    // Admin-only barber-type filter — an unauthenticated request can never
    // reach this because the controller strips the param before calling.
    ...(query.barberType ? { barberType: query.barberType as 'INTERNAL' | 'EXTERNAL' } : {}),
    // Coverage-area filter (#11) — partial match on external barbers' base.
    ...(query.location ? { location: { [Op.like]: `%${query.location}%` } } : {}),
  }

  const { rows, count } = await Barber.findAndCountAll({
    where,
    include: [
      {
        model: Service,
        as: 'services',
        through: { attributes: [] },
        // When filtering by serviceId, use INNER JOIN (required: true) so only
        // barbers assigned to that service are returned.
        // Without a serviceId filter, use LEFT JOIN (required: false) so barbers
        // with no service assignments still appear in the list.
        ...(query.serviceId
          ? { where: { id: query.serviceId }, required: true }
          : { required: false }),
      },
    ],
    distinct: true,
    order: [['name', 'ASC']],
    offset,
    limit,
  })

  // Admin callers get business fields (type/commission/location); public callers never do.
  const items = rows.map((barber) =>
    options.adminView ? serializeBarberForAdmin(barber, true) : serializeBarber(barber, true),
  )
  await attachReviewStats(items)

  if (includeInactive) {
    const countRows = await Appointment.findAll({
      attributes: ['barberId', [fn('COUNT', col('Appointment.id')), 'count']],
      group: ['barberId'],
      raw: true,
    })
    const countMap = new Map<number, number>()
    for (const row of countRows as unknown as Array<{ barberId: number; count: string }>) {
      countMap.set(row.barberId, Number(row.count))
    }
    for (const item of items) {
      const total = countMap.get(item.id)
      if (typeof total === 'number') item.appointmentCount = total
    }
  }

  return {
    items,
    total: count,
    page,
    perPage,
  }
}

export async function getBarberById(id: number): Promise<BarberPublic> {
  const barber = await Barber.findByPk(id, serviceScope)
  if (!barber) {
    throw new NotFoundError('Barber not found.')
  }
  const serialized = serializeBarber(barber, true)
  await attachReviewStats([serialized])
  return serialized
}

export async function getBarberByIdForAdmin(id: number): Promise<BarberAdmin> {
  const barber = await Barber.findByPk(id, serviceScope)
  if (!barber) {
    throw new NotFoundError('Barber not found.')
  }
  const serialized = serializeBarberForAdmin(barber, true)
  await attachReviewStats([serialized])
  return serialized
}

export async function updateBarber(id: number, input: UpdateBarberInput): Promise<BarberAdmin> {
  const barber = await Barber.findByPk(id)
  if (!barber) {
    throw new NotFoundError('Barber not found.')
  }

  const { serviceIds, ...data } = input

  if (Object.keys(data).length > 0) {
    const changes: Record<string, unknown> = { ...data }
    if (data.name && data.name !== barber.name) {
      changes.slug = await uniqueSlug(data.name, id)
    }
    await barber.update(changes)
  }
  if (serviceIds) {
    await barber.setServices(serviceIds)
  }

  return getBarberByIdForAdmin(id)
}

/**
 * Permanently removes a barber together with their availability slots and
 * service links. Only safe for barbers with NO appointment history — the
 * controller checks that first and deactivates instead when history exists.
 */
export async function deleteBarber(id: number): Promise<void> {
  const barber = await Barber.findByPk(id)
  if (!barber) {
    throw new NotFoundError('Barber not found.')
  }
  await BarberService.destroy({ where: { barberId: id } })
  await BarberAvailability.destroy({ where: { barberId: id } })
  await barber.destroy()
}

export async function countBarberAppointments(id: number): Promise<number> {
  return Appointment.count({ where: { barberId: id } })
}

export async function getBarberAvailability(barberId: number): Promise<BarberAvailability[]> {
  const barber = await Barber.findByPk(barberId)
  if (!barber) {
    throw new NotFoundError('Barber not found.')
  }
  return BarberAvailability.findAll({
    where: { barberId },
    order: [['dayOfWeek', 'ASC']],
  })
}

export async function upsertBarberAvailability(
  barberId: number,
  entries: Array<{
    dayOfWeek: number
    startTime: string
    endTime: string
    isAvailable?: boolean
  }>,
): Promise<BarberAvailability[]> {
  const barber = await Barber.findByPk(barberId)
  if (!barber) {
    throw new NotFoundError('Barber not found.')
  }

  for (const entry of entries) {
    const [record] = await BarberAvailability.findOrCreate({
      where: { barberId, dayOfWeek: entry.dayOfWeek },
      defaults: { ...entry, barberId },
    })
    await record.update({
      startTime: entry.startTime,
      endTime: entry.endTime,
      isAvailable: entry.isAvailable ?? true,
    })
  }

  return getBarberAvailability(barberId)
}