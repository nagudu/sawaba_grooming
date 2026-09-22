import { Barber, CommissionRateHistory } from '../models'
import { NotFoundError, UnprocessableError } from '../utils/errors'
import { getPagination } from '../utils/pagination'

export interface CommissionRateRow {
  barberId: number
  name: string
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
  effectiveFrom: Date | null
  portalEnabled: boolean
}

export interface CommissionRateHistoryItem {
  id: number
  barberId: number
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
  effectiveFrom: Date
  changedByAdminId: number | null
  createdAt: Date
}

export function serializeCommissionBarber(barber: Barber): CommissionRateRow {
  return {
    barberId: barber.id,
    name: barber.name,
    commissionType: barber.commissionType as 'PERCENTAGE' | 'FIXED',
    commissionValue: Number(barber.commissionValue),
    effectiveFrom: barber.commissionEffectiveFrom ?? null,
    portalEnabled: Boolean(barber.portalEnabled),
  }
}

export function serializeCommissionRateHistory(history: CommissionRateHistory): CommissionRateHistoryItem {
  return {
    id: history.id,
    barberId: history.barberId,
    commissionType: history.commissionType as 'PERCENTAGE' | 'FIXED',
    commissionValue: Number(history.commissionValue),
    effectiveFrom: history.effectiveFrom,
    changedByAdminId: history.changedByAdminId ?? null,
    createdAt: history.createdAt,
  }
}

export async function listCommissionRates(query: {
  commissionType?: 'PERCENTAGE' | 'FIXED'
  search?: string
  page?: number
  perPage?: number
}): Promise<{ items: CommissionRateRow[]; total: number; page: number; perPage: number }> {
  const { offset, limit, page, perPage } = getPagination(query)
  const where: Record<string, unknown> = {}
  if (query.commissionType) where.commissionType = query.commissionType
  if (query.search) {
    where[Op['or']] = [{ name: { [Op.iLike]: `%${query.search}%` } }]
  }

  const { rows, count } = await Barber.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    offset,
    limit,
  })

  return {
    items: rows.map(serializeCommissionBarber),
    total: count,
    page,
    perPage,
  }
}

export async function getCommissionRateHistory(
  barberId: number,
  query: { page?: number; perPage?: number },
): Promise<{ items: CommissionRateHistoryItem[]; total: number; page: number; perPage: number }> {
  await assertBarberExists(barberId)
  const { offset, limit, page, perPage } = getPagination(query)
  const { rows, count } = await CommissionRateHistory.findAndCountAll({
    where: { barberId },
    order: [['effectiveFrom', 'DESC']],
    offset,
    limit,
  })
  return { items: rows.map(serializeCommissionRateHistory), total: count, page, perPage }
}

export async function updateCommissionRate(
  barberId: number,
  input: { commissionType?: 'PERCENTAGE' | 'FIXED'; commissionValue?: number; effectiveFrom?: Date },
  changedByAdminId: number,
): Promise<CommissionRateRow> {
  const barber = await assertBarberExists(barberId)

  const nextType = input.commissionType ?? (barber.commissionType as 'PERCENTAGE' | 'FIXED')
  const nextValue = input.commissionValue ?? Number(barber.commissionValue)
  const effectiveFrom = input.effectiveFrom ?? new Date()

  if (
    nextType === (barber.commissionType as 'PERCENTAGE' | 'FIXED') &&
    nextValue === Number(barber.commissionValue)
  ) {
    throw new UnprocessableError('Commission rate is unchanged; provide a new value.')
  }

  await barber.update({
    commissionType: nextType,
    commissionValue: nextValue,
    commissionEffectiveFrom: effectiveFrom,
  })

  await CommissionRateHistory.create({
    barberId,
    commissionType: nextType,
    commissionValue: nextValue,
    effectiveFrom,
    changedByAdminId,
  })

  return serializeCommissionBarber(barber.reload())
}

async function assertBarberExists(barberId: number): Promise<Barber> {
  const barber = await Barber.findByPk(barberId)
  if (!barber) throw new NotFoundError('Barber not found.')
  return barber
}

import { Op } from 'sequelize'
