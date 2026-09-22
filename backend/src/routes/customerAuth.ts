import { Router } from 'express'
import {
  changePasswordHandler,
  loginPasswordHandler,
  meHandler,
  prefillHandler,
  registerHandler,
  requestOtpHandler,
  updateProfileHandler,
  verifyOtpHandler,
} from '../controllers/customerAuthController'
import { requireCustomer } from '../middleware/customerAuth'
import { validate } from '../middleware/validate'
import { customerAuthLimiter, otpLimiter } from '../middleware/rateLimiter'
import {
  customerLoginPasswordSchema,
  customerOtpRequestSchema,
  customerOtpVerifySchema,
  customerPasswordChangeSchema,
  customerProfileUpdateSchema,
  customerRegisterSchema,
} from '../validators/customerAuth'

export const customerAuthRouter = Router()

/**
 * @swagger
 * /api/account/otp/request:
 *   post:
 *     tags: [Account]
 *     summary: Request a login OTP (public)
 *     description: Sends a 6-digit code to the customer's saved email. Only existing accounts receive codes.
 */
customerAuthRouter.post('/otp/request', otpLimiter, validate(customerOtpRequestSchema), requestOtpHandler)

/**
 * @swagger
 * /api/account/otp/verify:
 *   post:
 *     tags: [Account]
 *     summary: Verify OTP and login (public)
 */
customerAuthRouter.post('/otp/verify', otpLimiter, validate(customerOtpVerifySchema), verifyOtpHandler)

/**
 * @swagger
 * /api/account/register:
 *   post:
 *     tags: [Account]
 *     summary: Create a customer account (public)
 *     description: One account per phone number; legacy guest records are upgraded, never duplicated.
 */
customerAuthRouter.post('/register', customerAuthLimiter, validate(customerRegisterSchema), registerHandler)

/**
 * @swagger
 * /api/account/login:
 *   post:
 *     tags: [Account]
 *     summary: Login with phone + password (public)
 */
customerAuthRouter.post('/login', customerAuthLimiter, validate(customerLoginPasswordSchema), loginPasswordHandler)

customerAuthRouter.get('/me', requireCustomer, meHandler)
customerAuthRouter.patch('/me', requireCustomer, validate(customerProfileUpdateSchema), updateProfileHandler)
customerAuthRouter.post(
  '/me/password',
  requireCustomer,
  validate(customerPasswordChangeSchema),
  changePasswordHandler,
)
customerAuthRouter.get('/booking-prefill', requireCustomer, prefillHandler)
