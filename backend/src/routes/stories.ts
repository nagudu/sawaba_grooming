import { Router } from 'express'
import { listPublicStoriesHandler, recordStoryViewHandler } from '../controllers/storyController'
import { attachCustomerIfPresent } from '../middleware/customerAuth'
import { validate } from '../middleware/validate'
import { storyIdParamsSchema, storyViewSchema } from '../validators/story'

/** Public Sawaba Stories feed + view tracking (guests allowed). */
export const storiesRouter = Router()

storiesRouter.get('/', listPublicStoriesHandler)
storiesRouter.post(
  '/:id/view',
  attachCustomerIfPresent,
  validate(storyIdParamsSchema, 'params'),
  validate(storyViewSchema),
  recordStoryViewHandler,
)
