import { z } from 'zod'

const optionalId = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
)

const optionalMoney = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().min(0).optional(),
)

export const storyCreateSchema = z.object({
  type: z.enum(['PRODUCT', 'BARBER', 'SERVICE', 'PROMOTION']),
  title: z.string().trim().min(3).max(160),
  caption: z.string().trim().max(1000).optional().or(z.literal('')),
  ctaLabel: z.string().trim().max(60).optional().or(z.literal('')),
  productId: optionalId,
  serviceId: optionalId,
  barberId: optionalId,
  offerUrl: z.string().trim().max(500).optional().or(z.literal('')),
  price: optionalMoney,
  compareAtPrice: optionalMoney,
  expiresInHours: z.coerce.number().min(1).max(168).optional(),
  status: z.enum(['DRAFT', 'APPROVED']).optional(),
})

export const storyUpdateSchema = storyCreateSchema.partial().extend({
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
})

export const storyModerateSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(300).optional().or(z.literal('')),
})

export const storyViewSchema = z.object({
  viewerKey: z.string().trim().min(10).max(120),
})

export const storyListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
  type: z.enum(['PRODUCT', 'BARBER', 'SERVICE', 'PROMOTION']).optional(),
  search: z.string().trim().max(150).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(50).optional(),
})

export const storyIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type StoryCreateBody = z.infer<typeof storyCreateSchema>
export type StoryUpdateBody = z.infer<typeof storyUpdateSchema>
