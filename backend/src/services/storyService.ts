import { Prisma, type Story, type StoryStatus, type StoryType } from '@prisma/client'
import { prisma } from '../config/database'
import { sendCustomerNotification } from './notificationService'
import { ForbiddenError, NotFoundError, UnprocessableError } from '../utils/errors'
import { getPagination } from '../utils/response'
import { deleteImageByUrl, deleteVideoByUrl } from '../utils/upload'

/** Sawaba Stories: 24h image/video stories with views, moderation and CTAs. */

export type StoryActor = { role: 'ADMIN' | 'VENDOR'; adminId?: number; vendorId?: number }

export interface CreateStoryInput {
  type: StoryType
  title: string
  caption?: string | null
  ctaLabel?: string | null
  productId?: number | null
  serviceId?: number | null
  barberId?: number | null
  offerUrl?: string | null
  price?: number | null
  compareAtPrice?: number | null
  expiresInHours?: number
  status?: 'DRAFT' | 'APPROVED'
  mediaType: 'IMAGE' | 'VIDEO'
  image?: string | null
  video?: string | null
  videoPublicId?: string | null
  thumbnailUrl?: string | null
  duration?: number | null
}

export type UpdateStoryInput = Partial<Omit<CreateStoryInput, 'mediaType' | 'image' | 'video' | 'videoPublicId' | 'thumbnailUrl' | 'duration'>> & {
  status?: StoryStatus
}

export interface StoryView {
  id: number
  ownerType: string
  ownerName: string
  type: StoryType
  status: string
  title: string
  caption: string | null
  mediaType: string
  image: string | null
  video: string | null
  thumbnailUrl: string | null
  duration: number | null
  ctaLabel: string
  ctaHref: string | null
  price: number | null
  compareAtPrice: number | null
  viewCount: number
  product: { id: number; name: string; slug: string } | null
  service: { id: number; name: string; slug: string } | null
  barber: { id: number; name: string; slug: string } | null
  vendor: { id: number; businessName: string } | null
  expiresAt: string
  createdAt: string
  approvedAt: string | null
  rejectedReason: string | null
}

interface Refs {
  products: Map<number, { id: number; name: string; slug: string; price: Prisma.Decimal; compareAtPrice: Prisma.Decimal | null; status: string; isActive: boolean; vendorId: number }>
  services: Map<number, { id: number; name: string; slug: string; price: Prisma.Decimal; isActive: boolean }>
  barbers: Map<number, { id: number; name: string; slug: string; isActive: boolean }>
  vendors: Map<number, { id: number; businessName: string; status: string; isActive: boolean }>
  admins: Map<number, { id: number; name: string }>
}

const STORY_FOLDER = 'sawaba-stories'

function uniqueIds(values: Array<number | null | undefined>): number[] {
  return [...new Set(values.filter((value): value is number => typeof value === 'number'))]
}

export function isSafeOfferUrl(value: string): boolean {
  const url = value.trim()
  return url.startsWith('/') || url.startsWith('https://sawabagroomingstudio.com.ng/')
}

function defaultCta(type: StoryType): string {
  if (type === 'PRODUCT') return 'Shop Now'
  if (type === 'BARBER') return 'Book Now'
  if (type === 'SERVICE') return 'View Service'
  return 'Explore Offer'
}

function effectiveStatus(story: Story): string {
  if (story.status !== 'EXPIRED' && story.expiresAt <= new Date()) return 'EXPIRED'
  return story.status
}

async function loadRefs(rows: Story[]): Promise<Refs> {
  const productIds = uniqueIds(rows.map((row) => row.productId))
  const serviceIds = uniqueIds(rows.map((row) => row.serviceId))
  const barberIds = uniqueIds(rows.map((row) => row.barberId))

  const [products, services, barbers, storyVendors, admins] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, slug: true, price: true, compareAtPrice: true, status: true, isActive: true, vendorId: true },
        })
      : [],
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, slug: true, price: true, isActive: true } })
      : [],
    barberIds.length
      ? prisma.barber.findMany({ where: { id: { in: barberIds } }, select: { id: true, name: true, slug: true, isActive: true } })
      : [],
    prisma.vendor.findMany({
      where: { id: { in: uniqueIds(rows.map((row) => row.vendorId)) } },
      select: { id: true, businessName: true, status: true, isActive: true },
    }),
    prisma.admin.findMany({
      where: { id: { in: uniqueIds(rows.map((row) => row.adminId)) } },
      select: { id: true, name: true },
    }),
  ])

  // Vendors referenced by the linked products are needed to validate the CTA.
  const productVendorIds = uniqueIds(products.map((product) => product.vendorId))
  const missingVendorIds = productVendorIds.filter((id) => !storyVendors.some((vendor) => vendor.id === id))
  const productVendors = missingVendorIds.length
    ? await prisma.vendor.findMany({
        where: { id: { in: missingVendorIds } },
        select: { id: true, businessName: true, status: true, isActive: true },
      })
    : []
  const allVendors = [...storyVendors, ...productVendors]

  return {
    products: new Map(products.map((product) => [product.id, product])),
    services: new Map(services.map((service) => [service.id, service])),
    barbers: new Map(barbers.map((barber) => [barber.id, barber])),
    vendors: new Map(allVendors.map((vendor) => [vendor.id, vendor])),
    admins: new Map(admins.map((admin) => [admin.id, admin])),
  }
}

function buildStoryView(story: Story, refs: Refs): StoryView {
  const product = story.productId ? refs.products.get(story.productId) ?? null : null
  const service = story.serviceId ? refs.services.get(story.serviceId) ?? null : null
  const barber = story.barberId ? refs.barbers.get(story.barberId) ?? null : null
  const vendor = story.vendorId ? refs.vendors.get(story.vendorId) ?? null : null
  const productVendor = product ? refs.vendors.get(product.vendorId) ?? null : null

  let ctaHref: string | null = null
  if (story.type === 'PRODUCT' && product) {
    const sellable = product.isActive && product.status === 'ACTIVE' && (!productVendor || (productVendor.status === 'APPROVED' && productVendor.isActive))
    if (sellable) ctaHref = `/shop/${product.slug}`
  } else if (story.type === 'SERVICE' && service && service.isActive) {
    ctaHref = `/services/${service.id}`
  } else if (story.type === 'BARBER' && barber && barber.isActive) {
    ctaHref = `/book?barber=${barber.id}`
  } else if (story.type === 'PROMOTION') {
    if (story.offerUrl && isSafeOfferUrl(story.offerUrl)) ctaHref = story.offerUrl
    else if (product) ctaHref = `/shop/${product.slug}`
  }

  const ownerName = vendor?.businessName ?? (story.adminId ? refs.admins.get(story.adminId)?.name ?? 'SAWABA Grooming Studio' : 'SAWABA Grooming Studio')
  const price = story.price ?? product?.price ?? service?.price ?? null
  const compareAtPrice = story.compareAtPrice ?? product?.compareAtPrice ?? null

  return {
    id: story.id,
    ownerType: story.ownerType,
    ownerName,
    type: story.type,
    status: effectiveStatus(story),
    title: story.title,
    caption: story.caption,
    mediaType: story.mediaType,
    image: story.image,
    video: story.video,
    thumbnailUrl: story.thumbnailUrl ?? story.image,
    duration: story.duration,
    ctaLabel: story.ctaLabel ?? defaultCta(story.type),
    ctaHref,
    price: price === null ? null : Number(price),
    compareAtPrice: compareAtPrice === null ? null : Number(compareAtPrice),
    viewCount: story.viewCount,
    product: product ? { id: product.id, name: product.name, slug: product.slug } : null,
    service: service ? { id: service.id, name: service.name, slug: service.slug } : null,
    barber: barber ? { id: barber.id, name: barber.name, slug: barber.slug } : null,
    vendor: vendor ? { id: vendor.id, businessName: vendor.businessName } : null,
    expiresAt: story.expiresAt.toISOString(),
    createdAt: story.createdAt.toISOString(),
    approvedAt: story.approvedAt?.toISOString() ?? null,
    rejectedReason: story.rejectedReason,
  }
}

async function getStoryView(id: number): Promise<StoryView> {
  const story = await prisma.story.findUnique({ where: { id } })
  if (!story) throw new NotFoundError('Story not found.')
  const refs = await loadRefs([story])
  return buildStoryView(story, refs)
}

/** Public feed: approved, unexpired, with a resolvable CTA. */
export async function listPublicStories(limit = 40): Promise<StoryView[]> {
  const rows = await prisma.story.findMany({
    where: { status: 'APPROVED', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(60, Math.max(1, limit)),
  })
  if (rows.length === 0) return []
  const refs = await loadRefs(rows)
  return rows
    .map((row) => buildStoryView(row, refs))
    .filter((view) => Boolean(view.ctaHref) && view.status === 'APPROVED')
}

/** Records one unique view per viewer key; returns the current total. */
export async function recordStoryView(
  storyId: number,
  viewerKey: string,
  customerId?: number | null,
): Promise<{ counted: boolean; viewCount: number }> {
  const story = await prisma.story.findFirst({
    where: { id: storyId, status: 'APPROVED', expiresAt: { gt: new Date() } },
    select: { id: true },
  })
  if (!story) throw new NotFoundError('Story not found or has expired.')

  const key = viewerKey.trim().slice(0, 120)
  if (key.length < 10) throw new UnprocessableError('Invalid viewer identifier.')

  const existing = await prisma.storyView.findUnique({
    where: { storyId_viewerKey: { storyId, viewerKey: key } },
  })
  if (existing) {
    const current = await prisma.story.findUnique({ where: { id: storyId }, select: { viewCount: true } })
    return { counted: false, viewCount: current?.viewCount ?? 0 }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.storyView.create({ data: { storyId, viewerKey: key, customerId: customerId ?? null } })
      await tx.story.update({ where: { id: storyId }, data: { viewCount: { increment: 1 } } })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const current = await prisma.story.findUnique({ where: { id: storyId }, select: { viewCount: true } })
      return { counted: false, viewCount: current?.viewCount ?? 0 }
    }
    throw error
  }
  const current = await prisma.story.findUnique({ where: { id: storyId }, select: { viewCount: true } })
  return { counted: true, viewCount: current?.viewCount ?? 0 }
}

async function validateProduct(productId: number, vendorId?: number) {
  const product = await prisma.product.findFirst({
    where: { id: productId, ...(vendorId ? { vendorId } : {}) },
    select: { id: true, name: true, slug: true, price: true, compareAtPrice: true, status: true, isActive: true, vendorId: true },
  })
  if (!product) throw new NotFoundError(vendorId ? 'Product not found in your store.' : 'Product not found.')
  if (!product.isActive || product.status === 'ARCHIVED') {
    throw new UnprocessableError('This product is not available for a story.')
  }
  return product
}

export async function createStory(input: CreateStoryInput, actor: StoryActor): Promise<StoryView> {
  const isVendor = actor.role === 'VENDOR'
  if (isVendor && !actor.vendorId) throw new ForbiddenError('Vendor account required.')

  if (isVendor && !['PRODUCT', 'PROMOTION'].includes(input.type)) {
    throw new UnprocessableError('Vendors can publish product stories only.')
  }
  if (!input.image && !input.video) {
    throw new UnprocessableError('Upload an image or a video for the story.')
  }

  let product: Awaited<ReturnType<typeof validateProduct>> | null = null
  let serviceId: number | null = null
  let barberId: number | null = null
  let offerUrl: string | null = input.offerUrl?.trim() || null

  if (isVendor) {
    if (!input.productId) throw new UnprocessableError('Select one of your products to link this story.')
    product = await validateProduct(input.productId, actor.vendorId)
    offerUrl = null
  } else if (input.type === 'PRODUCT') {
    if (!input.productId) throw new UnprocessableError('Select a product for this story.')
    product = await validateProduct(input.productId)
  } else if (input.type === 'SERVICE') {
    if (!input.serviceId) throw new UnprocessableError('Select a service for this story.')
    const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { id: true, isActive: true } })
    if (!service || !service.isActive) throw new UnprocessableError('Select an active service.')
    serviceId = service.id
  } else if (input.type === 'BARBER') {
    if (!input.barberId) throw new UnprocessableError('Select a barber for this story.')
    const barber = await prisma.barber.findUnique({ where: { id: input.barberId }, select: { id: true, isActive: true } })
    if (!barber || !barber.isActive) throw new UnprocessableError('Select an active barber.')
    barberId = barber.id
  } else if (input.type === 'PROMOTION') {
    if (!offerUrl && !input.productId) {
      throw new UnprocessableError('Add an offer link or link a product.')
    }
    if (offerUrl && !isSafeOfferUrl(offerUrl)) {
      throw new UnprocessableError('Offer links must be an internal page or the official SAWABA website.')
    }
    if (input.productId) product = await validateProduct(input.productId)
  }

  const hours = Math.min(168, Math.max(1, input.expiresInHours ?? 24))
  const now = new Date()
  const status: StoryStatus = isVendor ? 'PENDING' : input.status === 'DRAFT' ? 'DRAFT' : 'APPROVED'
  const price = input.price ?? (product ? Number(product.price) : null)
  const compareAtPrice =
    input.compareAtPrice ?? (product?.compareAtPrice != null ? Number(product.compareAtPrice) : null)

  const created = await prisma.story.create({
    data: {
      ownerType: actor.role,
      adminId: isVendor ? null : actor.adminId ?? null,
      vendorId: isVendor ? actor.vendorId! : null,
      type: input.type,
      status,
      title: input.title.trim(),
      caption: input.caption?.trim() || null,
      mediaType: input.mediaType,
      image: input.image ?? null,
      video: input.video ?? null,
      videoPublicId: input.videoPublicId ?? null,
      thumbnailUrl: input.thumbnailUrl ?? input.image ?? null,
      duration: input.duration ?? null,
      ctaLabel: (input.ctaLabel?.trim() || defaultCta(input.type)).slice(0, 60),
      productId: product?.id ?? null,
      serviceId,
      barberId,
      offerUrl,
      price: price === null ? null : new Prisma.Decimal(price),
      compareAtPrice: compareAtPrice === null ? null : new Prisma.Decimal(compareAtPrice),
      expiresAt: new Date(now.getTime() + hours * 3_600_000),
      approvedAt: status === 'APPROVED' ? now : null,
      approvedBy: status === 'APPROVED' ? actor.adminId ?? null : null,
    },
  })
  return getStoryView(created.id)
}

export async function updateStory(id: number, input: UpdateStoryInput, actor: StoryActor): Promise<StoryView> {
  const story = await prisma.story.findUnique({ where: { id } })
  if (!story) throw new NotFoundError('Story not found.')
  const isVendor = actor.role === 'VENDOR'
  if (isVendor && story.vendorId !== actor.vendorId) throw new ForbiddenError('You can only manage your own stories.')

  const data: Prisma.StoryUpdateInput = {}
  if (input.title !== undefined) data.title = input.title.trim()
  if (input.caption !== undefined) data.caption = input.caption?.trim() || null
  if (input.ctaLabel !== undefined) data.ctaLabel = input.ctaLabel?.trim().slice(0, 60) || defaultCta(story.type)
  if (input.price !== undefined) data.price = input.price === null ? null : new Prisma.Decimal(input.price)
  if (input.compareAtPrice !== undefined) {
    data.compareAtPrice = input.compareAtPrice === null ? null : new Prisma.Decimal(input.compareAtPrice)
  }
  if (input.expiresInHours !== undefined) {
    const hours = Math.min(168, Math.max(1, input.expiresInHours))
    data.expiresAt = new Date(Date.now() + hours * 3_600_000)
  }

  if (isVendor) {
    if (input.productId !== undefined) {
      if (!input.productId) throw new UnprocessableError('Select one of your products.')
      const product = await validateProduct(input.productId, actor.vendorId)
      data.productId = product.id
    }
    // Any vendor edit goes back to moderation.
    data.status = 'PENDING'
    data.approvedAt = null
    data.approvedBy = null
    data.rejectedReason = null
  } else {
    if (input.offerUrl !== undefined) {
      if (input.offerUrl && !isSafeOfferUrl(input.offerUrl)) {
        throw new UnprocessableError('Offer links must be an internal page or the official SAWABA website.')
      }
      data.offerUrl = input.offerUrl?.trim() || null
    }
    if (input.productId !== undefined) {
      data.productId = input.productId ? (await validateProduct(input.productId)).id : null
    }
    if (input.serviceId !== undefined) data.serviceId = input.serviceId ?? null
    if (input.barberId !== undefined) data.barberId = input.barberId ?? null
    if (input.status !== undefined) {
      data.status = input.status
      if (input.status === 'APPROVED') {
        data.approvedAt = new Date()
        data.approvedBy = actor.adminId ?? null
        data.rejectedReason = null
      }
    }
  }

  await prisma.story.update({ where: { id }, data })
  return getStoryView(id)
}

export async function moderateStory(
  id: number,
  action: 'APPROVE' | 'REJECT',
  reason: string | null | undefined,
  admin: { id: number },
): Promise<StoryView> {
  const story = await prisma.story.findUnique({ where: { id }, select: { id: true } })
  if (!story) throw new NotFoundError('Story not found.')
  if (action === 'APPROVE') {
    await prisma.story.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: admin.id, rejectedReason: null },
    })
  } else {
    await prisma.story.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason?.trim().slice(0, 300) || 'Rejected by admin.',
        approvedAt: null,
        approvedBy: null,
      },
    })
  }
  return getStoryView(id)
}

export async function deleteStory(id: number, actor: StoryActor): Promise<void> {
  const story = await prisma.story.findUnique({ where: { id } })
  if (!story) throw new NotFoundError('Story not found.')
  if (actor.role === 'VENDOR' && story.vendorId !== actor.vendorId) {
    throw new ForbiddenError('You can only delete your own stories.')
  }
  await prisma.story.delete({ where: { id } })
  await Promise.all([
    story.image ? deleteImageByUrl(story.image) : Promise.resolve(),
    story.video ? deleteVideoByUrl(story.video) : Promise.resolve(),
  ])
}

/**
 * Sends an opt-in promotional WhatsApp message for a live story. Only customers
 * with `whatsappOptIn` are targeted and dedupe keys prevent repeat sends.
 */
export async function promoteStory(
  id: number,
): Promise<{ targeted: number; sent: number; skipped: number }> {
  const story = await prisma.story.findUnique({ where: { id } })
  if (!story) throw new NotFoundError('Story not found.')
  if (story.status !== 'APPROVED' || story.expiresAt <= new Date()) {
    throw new UnprocessableError('Only a live, approved story can be promoted.')
  }
  const refs = await loadRefs([story])
  const view = buildStoryView(story, refs)
  const link = view.ctaHref
    ? new URL(view.ctaHref, 'https://sawabagroomingstudio.com.ng/').toString()
    : 'https://sawabagroomingstudio.com.ng/'

  const customers = await prisma.customer.findMany({
    where: { isActive: true, whatsappOptIn: true },
    select: { id: true },
    take: 200,
  })

  let sent = 0
  let skipped = 0
  for (const customer of customers) {
    try {
      const result = await sendCustomerNotification({
        event: 'PROMOTION',
        customer: { id: customer.id },
        context: {
          promoTitle: story.title,
          promoMessage: story.caption,
          promoUrl: link,
        },
        channels: ['WHATSAPP'],
        dedupeKey: `story-promo:${story.id}:${customer.id}`,
      })
      if (result.deliveries.some((delivery) => delivery.status === 'SENT')) sent += 1
      else skipped += 1
    } catch {
      skipped += 1
    }
  }
  return { targeted: customers.length, sent, skipped }
}

function storyWhere(query: { status?: string; type?: string; search?: string }): Prisma.StoryWhereInput {
  const where: Prisma.StoryWhereInput = {}
  if (query.status) where.status = query.status as StoryStatus
  if (query.type) where.type = query.type as StoryType
  if (query.search) {
    where.OR = [{ title: { contains: query.search } }, { caption: { contains: query.search } }]
  }
  return where
}

export async function listAdminStories(query: {
  status?: string
  type?: string
  search?: string
  page?: number
  perPage?: number
}): Promise<{ items: StoryView[]; total: number; page: number; perPage: number }> {
  const { page, perPage, offset, limit } = getPagination(query)
  const where = storyWhere(query)
  const [rows, total] = await Promise.all([
    prisma.story.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
    prisma.story.count({ where }),
  ])
  const refs = await loadRefs(rows)
  return { items: rows.map((row) => buildStoryView(row, refs)), total, page, perPage }
}

export async function listVendorStories(
  vendorId: number,
  query: { status?: string; type?: string; search?: string; page?: number; perPage?: number },
): Promise<{ items: StoryView[]; total: number; page: number; perPage: number }> {
  const { page, perPage, offset, limit } = getPagination(query)
  const where = { ...storyWhere(query), vendorId }
  const [rows, total] = await Promise.all([
    prisma.story.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
    prisma.story.count({ where }),
  ])
  const refs = await loadRefs(rows)
  return { items: rows.map((row) => buildStoryView(row, refs)), total, page, perPage }
}

/** Marks all stories past their expiry as EXPIRED. */
export async function expireStories(): Promise<number> {
  const result = await prisma.story.updateMany({
    where: { expiresAt: { lte: new Date() }, status: { not: 'EXPIRED' } },
    data: { status: 'EXPIRED' },
  })
  return result.count
}

/**
 * Expires due stories and purges rows/media that expired more than 24h ago.
 * Invoked by the in-process scheduler and the Vercel cron endpoint.
 */
export async function cleanupExpiredStories(): Promise<{ expired: number; deleted: number }> {
  const expired = await expireStories()
  const cutoff = new Date(Date.now() - 24 * 3_600_000)
  const stale = await prisma.story.findMany({
    where: { expiresAt: { lt: cutoff } },
    select: { id: true, image: true, video: true },
  })
  let deleted = 0
  for (const story of stale) {
    await prisma.story.delete({ where: { id: story.id } }).catch(() => undefined)
    if (story.image) await deleteImageByUrl(story.image)
    if (story.video) await deleteVideoByUrl(story.video)
    deleted += 1
  }
  return { expired, deleted }
}

export { STORY_FOLDER }
