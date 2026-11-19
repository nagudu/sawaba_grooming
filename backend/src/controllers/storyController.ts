import type { NextFunction, Request, Response } from 'express'
import type { StoryType } from '@prisma/client'
import {
  STORY_FOLDER,
  createStory,
  deleteStory,
  listAdminStories,
  listPublicStories,
  listVendorStories,
  moderateStory,
  promoteStory,
  recordStoryView,
  updateStory,
  type CreateStoryInput,
  type StoryActor,
  type UpdateStoryInput,
} from '../services/storyService'
import {
  MAX_IMAGE_SIZE_MB,
  deleteImageByUrl,
  deleteVideoByUrl,
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
} from '../utils/upload'
import { UnprocessableError } from '../utils/errors'
import { successRes } from '../utils/response'
import type { StoryCreateBody, StoryUpdateBody } from '../validators/story'

function handle(next: NextFunction, run: () => Promise<void>): void {
  run().catch(next)
}

function bodyString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function storyFiles(req: Request): { image?: Express.Multer.File; video?: Express.Multer.File } {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined
  return { image: files?.image?.[0], video: files?.video?.[0] }
}

interface UploadedStoryMedia {
  mediaType: 'IMAGE' | 'VIDEO'
  image: string | null
  video: string | null
  videoPublicId: string | null
  thumbnailUrl: string | null
  duration: number | null
}

async function uploadStoryMedia(req: Request): Promise<UploadedStoryMedia> {
  const { image, video } = storyFiles(req)
  let imageUrl: string | null = null
  let videoUrl: string | null = null
  let videoPublicId: string | null = null
  let thumbnailUrl: string | null = null
  let duration: number | null = null

  if (image) {
    if (image.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      throw new UnprocessableError(`Story images must be under ${MAX_IMAGE_SIZE_MB}MB.`)
    }
    const uploaded = await uploadImageToCloudinary(image.buffer, STORY_FOLDER, image.mimetype)
    imageUrl = uploaded.url
  }

  if (video) {
    const uploaded = await uploadVideoToCloudinary(video.buffer, `${STORY_FOLDER}/videos`, video.mimetype)
    videoUrl = uploaded.url
    videoPublicId = uploaded.publicId
    thumbnailUrl = uploaded.thumbnailUrl
    duration = uploaded.duration
    if (!imageUrl) imageUrl = uploaded.thumbnailUrl
  }

  if (!imageUrl && !videoUrl) {
    throw new UnprocessableError('Upload an image or a video for the story.')
  }

  return {
    mediaType: videoUrl ? 'VIDEO' : 'IMAGE',
    image: imageUrl,
    video: videoUrl,
    videoPublicId,
    thumbnailUrl: thumbnailUrl ?? imageUrl,
    duration,
  }
}

async function deleteUploadedMedia(media: UploadedStoryMedia): Promise<void> {
  await Promise.all([
    media.image ? deleteImageByUrl(media.image) : Promise.resolve(),
    media.video ? deleteVideoByUrl(media.video) : Promise.resolve(),
  ])
}

function toCreateInput(body: StoryCreateBody, media: UploadedStoryMedia): CreateStoryInput {
  return {
    type: body.type as StoryType,
    title: body.title,
    caption: body.caption ?? null,
    ctaLabel: body.ctaLabel ?? null,
    productId: body.productId ?? null,
    serviceId: body.serviceId ?? null,
    barberId: body.barberId ?? null,
    offerUrl: body.offerUrl ?? null,
    price: body.price ?? null,
    compareAtPrice: body.compareAtPrice ?? null,
    expiresInHours: body.expiresInHours,
    status: body.status,
    mediaType: media.mediaType,
    image: media.image,
    video: media.video,
    videoPublicId: media.videoPublicId,
    thumbnailUrl: media.thumbnailUrl,
    duration: media.duration,
  }
}

async function createForActor(req: Request, actor: StoryActor, message: string, res: Response): Promise<void> {
  const body = req.body as StoryCreateBody
  let media: UploadedStoryMedia | null = null
  try {
    media = await uploadStoryMedia(req)
    const story = await createStory(toCreateInput(body, media), actor)
    successRes(res, message, story, 201)
  } catch (error) {
    if (media) await deleteUploadedMedia(media)
    throw error
  }
}

// ─── Public ──────────────────────────────────────────────────────────────────

export const listPublicStoriesHandler = (_req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    successRes(res, 'Stories retrieved.', await listPublicStories())
  })

export const recordStoryViewHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    const id = Number(req.params.id)
    const viewerKey = String((req.body as { viewerKey: string }).viewerKey)
    const result = await recordStoryView(id, viewerKey, req.customer?.id ?? null)
    successRes(res, 'Story view recorded.', result)
  })

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminListStoriesHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    const result = await listAdminStories({
      status: bodyString(req.query.status),
      type: bodyString(req.query.type),
      search: bodyString(req.query.search),
      page: Number(req.query.page) || undefined,
      perPage: Number(req.query.perPage) || undefined,
    })
    successRes(res, 'Stories retrieved.', result)
  })

export const adminCreateStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    await createForActor(req, { role: 'ADMIN', adminId: req.admin!.id }, 'Story published.', res)
  })

export const adminUpdateStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    const story = await updateStory(Number(req.params.id), req.body as StoryUpdateBody as UpdateStoryInput, {
      role: 'ADMIN',
      adminId: req.admin!.id,
    })
    successRes(res, 'Story updated.', story)
  })

export const adminModerateStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    const { action, reason } = req.body as { action: 'APPROVE' | 'REJECT'; reason?: string }
    const story = await moderateStory(Number(req.params.id), action, reason, { id: req.admin!.id })
    successRes(res, action === 'APPROVE' ? 'Story approved.' : 'Story rejected.', story)
  })

export const adminDeleteStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    await deleteStory(Number(req.params.id), { role: 'ADMIN', adminId: req.admin!.id })
    successRes(res, 'Story deleted.', {})
  })

export const adminPromoteStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    const result = await promoteStory(Number(req.params.id))
    successRes(
      res,
      result.targeted === 0
        ? 'No opted-in customers to notify yet.'
        : `Promotion sent to ${result.sent} of ${result.targeted} opted-in customer(s).`,
      result,
    )
  })

// ─── Vendor ──────────────────────────────────────────────────────────────────

export const vendorListStoriesHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    const result = await listVendorStories(req.vendor!.id, {
      status: bodyString(req.query.status),
      type: bodyString(req.query.type),
      search: bodyString(req.query.search),
      page: Number(req.query.page) || undefined,
      perPage: Number(req.query.perPage) || undefined,
    })
    successRes(res, 'Stories retrieved.', result)
  })

export const vendorCreateStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    await createForActor(
      req,
      { role: 'VENDOR', vendorId: req.vendor!.id },
      'Story submitted for review.',
      res,
    )
  })

export const vendorUpdateStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    const story = await updateStory(Number(req.params.id), req.body as StoryUpdateBody as UpdateStoryInput, {
      role: 'VENDOR',
      vendorId: req.vendor!.id,
    })
    successRes(res, 'Story updated and resubmitted for review.', story)
  })

export const vendorDeleteStoryHandler = (req: Request, res: Response, next: NextFunction): void =>
  handle(next, async () => {
    await deleteStory(Number(req.params.id), { role: 'VENDOR', vendorId: req.vendor!.id })
    successRes(res, 'Story deleted.', {})
  })
