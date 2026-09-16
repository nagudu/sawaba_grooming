import type { NextFunction, Request, Response } from 'express'
import {
  changeCustomerPassword,
  loginWithPassword,
  registerCustomer,
  requestLoginOtp,
  serializeCustomer,
  updateCustomerProfile,
  verifyLoginOtp,
} from '../services/customerAuthService'
import { getBookingPrefill } from '../services/customerMeService'
import { successRes } from '../utils/response'
import type {
  CustomerLoginPasswordInput,
  CustomerOtpRequestInput,
  CustomerOtpVerifyInput,
  CustomerProfileUpdateInput,
  CustomerRegisterInput,
} from '../validators/customerAuth'

export async function requestOtpHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone } = req.body as CustomerOtpRequestInput
    const result = await requestLoginOtp(phone)
    successRes(res, result.message, result, 200)
  } catch (error) {
    next(error)
  }
}

export async function verifyOtpHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, code } = req.body as CustomerOtpVerifyInput
    const { token, customer } = await verifyLoginOtp(phone, code)
    successRes(
      res,
      'Welcome back! You are now logged in.',
      { token, customer: serializeCustomer(customer) },
      200,
    )
  } catch (error) {
    next(error)
  }
}

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as CustomerRegisterInput
    const { token, customer } = await registerCustomer(input)
    successRes(res, 'Account created. Welcome to SAWABA!', { token, customer: serializeCustomer(customer) }, 201)
  } catch (error) {
    next(error)
  }
}

export async function loginPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, password } = req.body as CustomerLoginPasswordInput
    const { token, customer } = await loginWithPassword(phone, password)
    successRes(res, 'Welcome back!', { token, customer: serializeCustomer(customer) }, 200)
  } catch (error) {
    next(error)
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successRes(res, 'Profile retrieved.', { customer: serializeCustomer(req.customer!) }, 200)
  } catch (error) {
    next(error)
  }
}

export async function updateProfileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patch = req.body as CustomerProfileUpdateInput
    const customer = await updateCustomerProfile(req.customer!.id, patch)
    successRes(res, 'Profile updated.', { customer: serializeCustomer(customer) }, 200)
  } catch (error) {
    next(error)
  }
}

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string
      newPassword: string
    }
    await changeCustomerPassword(req.customer!.id, currentPassword ?? null, newPassword)
    successRes(res, 'Password updated.', {}, 200)
  } catch (error) {
    next(error)
  }
}

/** Booking form prefill for logged-in customers (identity + usual service). */
export async function prefillHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const prefill = await getBookingPrefill(req.customer!)
    successRes(res, 'Booking prefill retrieved.', prefill, 200)
  } catch (error) {
    next(error)
  }
}
