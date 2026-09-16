import { rateLimit } from 'express-rate-limit'

const defaultConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
}

/** General API limiter: 300 requests per 15 minutes per IP. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  ...defaultConfig,
})

/** Stricter limiter for authentication endpoints: 10 attempts per 15 minutes. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  ...defaultConfig,
})

/** Limiter for public submission endpoints (bookings, contact, reviews). */
export const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  ...defaultConfig,
})