import { Router } from 'express'
import { requireVendor } from '../middleware/vendorAuth'
import { validate } from '../middleware/validate'
import { galleryUpload } from '../utils/upload'
import {
  vendorCreateStoryHandler,
  vendorDeleteStoryHandler,
  vendorListStoriesHandler,
  vendorUpdateStoryHandler,
} from '../controllers/storyController'
import {
  storyCreateSchema,
  storyIdParamsSchema,
  storyListQuerySchema,
  storyUpdateSchema,
} from '../validators/story'

/** Vendors manage their own product stories; every new/edited story is moderated. */
export const vendorStoriesRouter = Router()
vendorStoriesRouter.use(requireVendor)

vendorStoriesRouter.get('/', validate(storyListQuerySchema, 'query'), vendorListStoriesHandler)
vendorStoriesRouter.post(
  '/',
  galleryUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  validate(storyCreateSchema),
  vendorCreateStoryHandler,
)
vendorStoriesRouter.patch('/:id', validate(storyIdParamsSchema, 'params'), validate(storyUpdateSchema), vendorUpdateStoryHandler)
vendorStoriesRouter.delete('/:id', validate(storyIdParamsSchema, 'params'), vendorDeleteStoryHandler)
