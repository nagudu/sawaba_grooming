import { prisma } from '../config/database'
import type { Service } from '@prisma/client'
import { ConflictError, NotFoundError } from '../utils/errors'
import { slugify } from '../utils/slug'
import { getPagination } from '../utils/response'
import type { CreateServiceInput, UpdateServiceInput } from '../validators/service'
import type { Paged } from '../types'

export interface ServicePublic {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  duration: number
  image: string | null
  category: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export function serializeService(service: Service): ServicePublic {
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    price: Number(service.price),
    duration: service.duration,
    image: service.image,
    category: service.category,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  }
}

async function uniqueSlug(name: string, excludeId?: number): Promise<string> {
  const base = slugify(name)
  let candidate = base
  let counter = 2

  while (true) {
    const existing = await prisma.service.findFirst({
      where: excludeId
        ? { slug: candidate, id: { not: excludeId } }
        : { slug: candidate },
    })
    if (!existing) return candidate
    candidate = `${base}-${counter}`
    counter += 1
  }
}

export async function createService(input: CreateServiceInput): Promise<ServicePublic> {
  const slug = await uniqueSlug(input.name)
  const service = await prisma.service.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      price: input.price,
      duration: input.duration,
      image: input.image ?? null,
      category: input.category ?? 'HAIRCUTS',
      isActive: input.isActive ?? true,
    },
  })
  return serializeService(service)
}

export async function listServices(
  query: { category?: string; isActive?: string; search?: string; page?: number; perPage?: number },
  includeInactive = false,
): Promise<Paged<ServicePublic>> {
  const { page, perPage, offset, limit } = getPagination(query as Record<string, unknown>)

  const where: {
    category?: string
    isActive?: boolean
    OR?: Array<{
      name?: { contains: string }
      slug?: { contains: string }
      description?: { contains: string }
    }>
  } = {}

  if (query.category) {
    where.category = query.category
  }

  if (!includeInactive) {
    where.isActive = true
  } else if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true'
  }

  if (query.search) {
    const search = query.search
    where.OR = [
      { name: { contains: search } },
      { slug: { contains: search } },
      { description: { contains: search } },
    ]
  }

  const [rows, count] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.service.count({ where }),
  ])

  return {
    items: rows.map(serializeService),
    total: count,
    page,
    perPage,
  }
}

export async function getServiceById(id: number): Promise<ServicePublic> {
  const service = await prisma.service.findUnique({
    where: { id },
  })
  if (!service) {
    throw new NotFoundError('Service not found.')
  }
  return serializeService(service)
}

export async function updateService(id: number, input: UpdateServiceInput): Promise<ServicePublic> {
  const service = await prisma.service.findUnique({
    where: { id },
  })
  if (!service) {
    throw new NotFoundError('Service not found.')
  }

  let slug = service.slug
  if (input.name && input.name !== service.name) {
    slug = await uniqueSlug(input.name, id)
  }

  const updated = await prisma.service.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name, slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.duration !== undefined ? { duration: input.duration } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })
  return serializeService(updated)
}

export async function deleteService(id: number): Promise<void> {
  const service = await prisma.service.findUnique({
    where: { id },
  })
  if (!service) {
    throw new NotFoundError('Service not found.')
  }

  const appointmentCount = await prisma.appointment.count({ where: { serviceId: id } })
  if (appointmentCount > 0) {
    throw new ConflictError(
      'This service has appointments attached. Deactivate it instead of deleting.',
    )
  }

  await prisma.service.delete({ where: { id } })
}