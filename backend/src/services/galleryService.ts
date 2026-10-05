import { prisma } from '../config/database'
import type { Gallery, Barber, GalleryCategory } from '@prisma/client'
import { AppError, NotFoundError } from '../utils/errors'
import { getPagination } from '../utils/response'
import { deleteImageByUrl } from '../utils/upload'
import type { CreateGalleryInput, UpdateGalleryInput } from '../validators/gallery'
import type { Paged } from '../types'

export interface GalleryPublic {
  id: number
  title: string
  image: string
  category: string
  barberId: number | null
  createdAt: Date
  updatedAt: Date
  barber?: { id: number; name: string } | null
}

function serializeGallery(
  image: Gallery & { barber?: Pick<Barber, 'id' | 'name'> | null },
): GalleryPublic {
  return {
    id: image.id,
    title: image.title,
    image: image.image,
    category: image.category,
    barberId: image.barberId ?? null,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
    barber: image.barber ? { id: image.barber.id, name: image.barber.name } : null,
  }
}

export async function createGallery(input: CreateGalleryInput): Promise<GalleryPublic> {
  if (input.barberId) {
    const barber = await prisma.barber.findUnique({ where: { id: input.barberId } })
    if (!barber) {
      throw new NotFoundError('Linked barber does not exist.')
    }
  }

  if (!input.image) {
    throw new AppError('An image is required. Upload a file or provide an image URL.', 400)
  }

  const image = await prisma.gallery.create({
    data: {
      title: input.title,
      category: (input.category as GalleryCategory) ?? 'HAIRCUT',
      barberId: input.barberId ?? null,
      image: input.image,
    },
  })
  return getGalleryById(image.id)
}

export async function listGallery(query: {
  category?: string
  barberId?: number
  page?: number
  perPage?: number
}): Promise<Paged<GalleryPublic>> {
  const { page, perPage, offset, limit } = getPagination(query)

  const where: {
    category?: GalleryCategory
    barberId?: number
  } = {}

  if (query.category) where.category = query.category as GalleryCategory
  if (query.barberId) where.barberId = query.barberId

  const [rows, count] = await Promise.all([
    prisma.gallery.findMany({
      where,
      include: { barber: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.gallery.count({ where }),
  ])

  return { items: rows.map(serializeGallery), total: count, page, perPage }
}

export async function getGalleryById(id: number): Promise<GalleryPublic> {
  const image = await prisma.gallery.findUnique({
    where: { id },
    include: { barber: { select: { id: true, name: true } } },
  })
  if (!image) {
    throw new NotFoundError('Gallery item not found.')
  }
  return serializeGallery(image)
}

export async function updateGalleryItem(
  id: number,
  input: UpdateGalleryInput,
): Promise<GalleryPublic> {
  const image = await prisma.gallery.findUnique({ where: { id } })
  if (!image) {
    throw new NotFoundError('Gallery item not found.')
  }

  if (input.barberId) {
    const barber = await prisma.barber.findUnique({ where: { id: input.barberId } })
    if (!barber) {
      throw new NotFoundError('Linked barber does not exist.')
    }
  }

  await prisma.gallery.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category as GalleryCategory } : {}),
      ...(input.barberId !== undefined ? { barberId: input.barberId } : {}),
      ...(input.image !== undefined && input.image !== null ? { image: input.image } : {}),
    },
  })
  return getGalleryById(id)
}

export async function deleteGalleryItem(id: number): Promise<void> {
  const image = await prisma.gallery.findUnique({ where: { id } })
  if (!image) {
    throw new NotFoundError('Gallery item not found.')
  }

  await deleteImageByUrl(image.image).catch(() => undefined)
  await prisma.gallery.delete({ where: { id } })
}