import type { Request, Response } from 'express'
import {
  changeBarberPassword,
  getBarberMe,
  loginBarber,
} from '../services/barberAuthService'
import { successRes } from '../utils/response'

export async function loginBarberController(req: Request, res: Response): Promise<void> {
  try {
    const session = await loginBarber(req.body)
    successRes(res, 'Login successful.', session, 200)
  } catch (error) {
    throw error
  }
}

export async function getBarberMeController(req: Request, res: Response): Promise<void> {
  try {
    const barber = await getBarberMe(req.barber!.id)
    successRes(res, 'Barber profile fetched.', { barber }, 200)
  } catch (error) {
    throw error
  }
}

export async function changeBarberPasswordController(req: Request, res: Response): Promise<void> {
  try {
    await changeBarberPassword(req.barber!.id, req.body)
    successRes(res, 'Password updated.', undefined, 200)
  } catch (error) {
    throw error
  }
}