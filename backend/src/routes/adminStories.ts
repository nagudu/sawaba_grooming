import { Router } from 'express'
import { requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { galleryUpload } from '../utils/upload'
import {
  adminCreateStoryHandler,
  adminDeleteStoryHandler,
  adminListStoriesHandler,
  adminModerateStoryHandler,
  adminPromoteStoryHandler,
  adminUpdateStoryHandler,
} from '../controllers/storyController'
import {
  storyCreateSchema,
  storyIdParamsSchema,
  storyListQuerySchema,
  storyModerateSchema,
  storyUpdateSchema,
} from '../validators/story'

/** Admin full control over Sawaba Stories. */
export const adminStoriesRouter = Router()
adminStoriesRouter.use(requireAdmin)

adminStoriesRouter.get('/', validate(storyListQuerySchema, 'query'), adminListStoriesHandler)
adminStoriesRouter.post(
  '/',
  galleryUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  validate(storyCreateSchema),
  adminCreateStoryHandler,
)
adminStoriesRouter.patch('/:id', validate(storyIdParamsSchema, 'params'), validate(storyUpdateSchema), adminUpdateStoryHandler)
adminStoriesRouter.post(
  '/:id/moderate',
  validate(storyIdParamsSchema, 'params'),
  validate(storyModerateSchema),
  adminModerateStoryHandler,
)
adminStoriesRouter.post('/:id/promote', validate(storyIdParamsSchema, 'params'), adminPromoteStoryHandler)
adminStoriesRouter.delete('/:id', validate(storyIdParamsSchema, 'params'), adminDeleteStoryHandler)
