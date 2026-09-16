import crypto from 'node:crypto'
import { Op } from 'sequelize'
import {
  Appointment,
  Barber,
  BarberAvailability,
  BarberService,
  Payment,
  Service,
} from '../models'
import { ConflictError, NotFoundError, UnprocessableError } from '../utils/errors'
import { getPagination } from '../utils/response'
import { hhmmToMinutes } from './availabilityService'
import { findOrCreateCustomer } from './customerService'
import { markPaymentCancelled } from './paymentService'
import {
  APPOINTMENT_STATUSES,
  canTransition,
  AppointmentStatusValue,
  PAID_GATED_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  getValidNextStatuses,
} from '../config/appointmentStatuses'
import type { CreateAppointmentInput, UpdateAppointmentInput } from '../validators/appointment'
import type { AppointmentStatus, Paged, PaymentMethod, PaymentStatus } from '../types'

function generatePaymentToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

function dateKey(date: string): string {
  return date.replace(/-/g, '')
}

async function generateReferenceCode(appointmentDate: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const key = dateKey(appointmentDate)
    const dayCount = await Appointment.count({ where: { appointmentDate } })
    const candidate = `APT-${key}-${String(dayCount + 1 + attempt).padStart(3, '0')}`
    const taken = await Appointment.findOne({ where: { referenceCode: candidate } })
    if (!taken) return candidate
  }
  const key = dateKey(appointmentDate)
  const salt = crypto.randomBytes(2).toString('hex').toUpperCase()
  return `APT-${key}-${salt}`
}

export interface AppointmentPublic {
  id: number
  referenceCode: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  customerId: number | null
  serviceId: number
  barberId: number
  appointmentDate: string
  appointmentTime: string
  totalAmount: number
  notes: string | null
  status: AppointmentStatus
  serviceStartedAt: Date | null
  completedAt: Date | null
  cancelledAt: Date | null
  cancellationReason: string | null
  cancelledBy: number | null
  createdAt: Date
  updatedAt: Date
  service?: { id: number; name: string; price: number; duration: number }
  barber?: { id: number; name: string; image: string | null }
  payment?: null | {
    id: number
    status: PaymentStatus
    amount: number
    paymentMethod: PaymentMethod | null
    accessToken: string
  }
}

export interface BookingConfirmation {
  appointment: AppointmentPublic
  payment: { id: number; accessToken: string; amount: number; status: PaymentStatus }
}

const includeRelations = [
  {
    model: Service,
    as: 'service',
    attributes: ['id', 'name', 'price', 'duration'],
  },
  {
    model: Barber,
    as: 'barber',
    attributes: ['id', 'name', 'image'],
  },
  {
    model: Payment,
    as: 'payment',
    attributes: ['id', 'status', 'amount', 'paymentMethod', 'accessToken'],
  },
]

export function serializeAppointment(appointment: Appointment): AppointmentPublic {
  const base: AppointmentPublic = {
    id: appointment.id,
    referenceCode: appointment.referenceCode,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    customerEmail: appointment.customerEmail,
    customerId: appointment.customerId,
    serviceId: appointment.serviceId,
    barberId: appointment.barberId,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    totalAmount: Number(appointment.totalAmount),
    notes: appointment.notes,
    status: appointment.status,
    serviceStartedAt: appointment.serviceStartedAt,
    completedAt: appointment.completedAt,
    cancelledAt: appointment.cancelledAt,
    cancellationReason: appointment.cancellationReason,
    cancelledBy: appointment.cancelledBy,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  }

  if (appointment.service) {
    base.service = {
      id: appointment.service.id,
      name: appointment.service.name,
      price: Number(appointment.service.price),
      duration: appointment.service.duration,
    }
  }
  if (appointment.barber) {
    base.barber = {
      id: appointment.barber.id,
      name: appointment.barber.name,
      image: appointment.barber.image,
    }
  }
  if (appointment.payment) {
    base.payment = {
      id: appointment.payment.id,
      status: appointment.payment.status,
      amount: Number(appointment.payment.amount),
      paymentMethod: appointment.payment.paymentMethod,
      // Capability token for the customer's own payment/receipt pages — the
      // dashboard needs it to build Pay Now / receipt links.
      accessToken: appointment.payment.accessToken,
    }
  }

  return base
}

interface SlotCheckResult {
  serviceDuration: number
  servicePrice: number
}

async function assertBookableSlot(
  barberId: number,
  serviceId: number | null,
  date: string,
  time: string,
  excludeAppointmentId?: number,
): Promise<SlotCheckResult> {
  const barber = await Barber.findByPk(barberId)
  if (!barber || !barber.isActive) {
    throw new UnprocessableError('The selected barber is not available.')
  }

  let serviceDuration = 0
  let servicePrice = 0
  if (serviceId !== null) {
    const service = await Service.findByPk(serviceId)
    if (!service || !service.isActive) {
      throw new UnprocessableError('The selected service is not available.')
    }
    serviceDuration = service.duration
    servicePrice = Number(service.price)

    const providerLink = await BarberService.findOne({ where: { barberId, serviceId } })
    const hasAnyServices = await BarberService.findOne({ where: { barberId } })
    // If the barber has at least one service assignment and this service is not
    // among them, reject. If the barber has NO assignments yet (admin hasn't
    // configured them), allow all services (single-salon fallback).
    if (hasAnyServices && !providerLink) {
      throw new UnprocessableError('This barber does not provide the selected service.')
    }
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay()

  // Check if ANY availability rows exist for this barber at all.
  const hasAnyAvailability = await BarberAvailability.findOne({ where: { barberId } })

  if (hasAnyAvailability) {
    // Availability has been configured — enforce it strictly.
    const availability = await BarberAvailability.findOne({
      where: { barberId, dayOfWeek, isAvailable: true },
    })
    if (!availability) {
      throw new UnprocessableError('The barber is not available on the requested day.')
    }
    if (time < availability.startTime || time >= availability.endTime) {
      throw new UnprocessableError('The requested time is outside the barber working hours.')
    }
  }
  // If no availability rows exist yet (admin hasn't configured the schedule),
  // skip the availability check entirely. The barber is treated as available
  // every day during the salon's operating hours shown on the booking page.
  // Once the admin sets up a schedule, it will be enforced automatically.

  // Use date-only comparison for the "in the past" guard so that timezone
  // differences between client and server never reject a valid same-day slot.
  // Anything strictly before today's date is rejected; same-day slots are
  // always allowed (the customer can see them on the booking page).
  const todayISO = new Date().toISOString().slice(0, 10)
  if (date < todayISO) {
    throw new UnprocessableError('Appointments cannot be booked in the past.')
  }

  const start = hhmmToMinutes(time)

  const existingQuery = {
    barberId,
    appointmentDate: date,
    status: { [Op.ne]: AppointmentStatusValue.CANCELLED },
  }
  const existing = excludeAppointmentId
    ? await Appointment.findAll({ where: { ...existingQuery, id: { [Op.ne]: excludeAppointmentId } } })
    : await Appointment.findAll({ where: existingQuery })

  const serviceIds = [...new Set(existing.map((a) => a.serviceId))]
  const services = await Service.findAll({ where: { id: serviceIds } })
  const serviceMap = new Map(services.map((s) => [s.id, s.duration]))

  const end = start + serviceDuration

  const conflict = existing.find((appointment) => {
    const existingStart = hhmmToMinutes(appointment.appointmentTime)
    const existingEnd =
      existingStart + (serviceMap.get(appointment.serviceId) ?? serviceDuration)
    return start < existingEnd && end > existingStart
  })

  if (conflict) {
    throw new ConflictError(
      'This time slot is no longer available. Please choose another time.',
    )
  }

  return { serviceDuration, servicePrice }
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<BookingConfirmation> {
  const { servicePrice } = await assertBookableSlot(
    input.barberId,
    input.serviceId,
    input.appointmentDate,
    input.appointmentTime,
  )

  const customer = await findOrCreateCustomer({
    fullName: input.customerName,
    phone: input.customerPhone,
    email: input.customerEmail ?? null,
  })

  const appointment = await Appointment.create({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail ?? null,
    customerId: customer.id,
    serviceId: input.serviceId,
    barberId: input.barberId,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    totalAmount: servicePrice,
    notes: input.notes ?? null,
    status: AppointmentStatusValue.PAYMENT_REQUIRED,
    referenceCode: await generateReferenceCode(input.appointmentDate),
  })

  const payment = await Payment.create({
    appointmentId: appointment.id,
    customerId: customer.id,
    amount: servicePrice,
    paymentMethod: null,
    transactionReference: null,
    paymentDate: null,
    receiptUrl: null,
    note: null,
    status: 'UNPAID',
    accessToken: generatePaymentToken(),
  })

  const fresh = await Appointment.findByPk(appointment.id, { include: includeRelations })
  return {
    appointment: serializeAppointment(fresh!),
    payment: {
      id: payment.id,
      accessToken: payment.accessToken,
      amount: Number(payment.amount),
      status: payment.status,
    },
  }
}

export async function listAppointments(query: {
  status?: AppointmentStatus
  barberId?: number
  serviceId?: number
  from?: string
  to?: string
  search?: string
  page?: number
  perPage?: number
}): Promise<Paged<AppointmentPublic>> {
  const { page, perPage, offset, limit } = getPagination(query as Record<string, unknown>)

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.barberId ? { barberId: query.barberId } : {}),
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    ...(query.from || query.to
      ? {
          appointmentDate: {
            ...(query.from ? { [Op.gte]: query.from } : {}),
            ...(query.to ? { [Op.lte]: query.to } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          [Op.or]: [
            { referenceCode: { [Op.like]: `%${query.search}%` } },
            { customerName: { [Op.like]: `%${query.search}%` } },
            { customerPhone: { [Op.like]: `%${query.search}%` } },
            { customerEmail: { [Op.like]: `%${query.search}%` } },
          ],
        }
      : {}),
  }

  const { rows, count } = await Appointment.findAndCountAll({
    where,
    include: includeRelations,
    order: [
      ['appointmentDate', 'DESC'],
      ['appointmentTime', 'DESC'],
    ],
    offset,
    limit,
  })

  return {
    items: rows.map(serializeAppointment),
    total: count,
    page,
    perPage,
  }
}

export async function getAppointmentById(id: number): Promise<AppointmentPublic> {
  const appointment = await Appointment.findByPk(id, { include: includeRelations })
  if (!appointment) {
    throw new NotFoundError('Appointment not found.')
  }
  return serializeAppointment(appointment)
}

export async function updateAppointment(
  id: number,
  input: UpdateAppointmentInput,
): Promise<AppointmentPublic> {
  const appointment = await Appointment.findByPk(id)
  if (!appointment) {
    throw new NotFoundError('Appointment not found.')
  }

  if (input.appointmentDate || input.appointmentTime || input.barberId || input.serviceId) {
    const nextBarberId = input.barberId ?? appointment.barberId
    const nextServiceId = input.serviceId ?? appointment.serviceId
    const nextDate = input.appointmentDate ?? appointment.appointmentDate
    const nextTime = input.appointmentTime ?? appointment.appointmentTime
    await assertBookableSlot(nextBarberId, nextServiceId, nextDate, nextTime, id)
  }

  await appointment.update(input)
  return getAppointmentById(id)
}

const VALID_STATUSES: AppointmentStatus[] = APPOINTMENT_STATUSES

/** Keeps the payment record aligned when an admin moves an appointment through the payment lifecycle. */
async function syncPaymentForStatus(
  appointmentId: number,
  status: AppointmentStatus,
  adminId?: number | null,
): Promise<void> {
  const payment = await Payment.findOne({ where: { appointmentId } })
  if (!payment) return

  if (status === AppointmentStatusValue.PAYMENT_VERIFIED && payment.status !== 'PAID') {
    await payment.update({
      status: 'PAID',
      verifiedAt: new Date(),
      verifiedBy: adminId ?? null,
      rejectionReason: null,
    })
  } else if (
    status === AppointmentStatusValue.PAYMENT_REJECTED &&
    (payment.status === 'PENDING_VERIFICATION' || payment.status === 'UNPAID')
  ) {
    await payment.update({ status: 'REJECTED', verifiedAt: null })
  } else if (
    status === AppointmentStatusValue.PAYMENT_SUBMITTED &&
    payment.status !== 'PENDING_VERIFICATION' &&
    payment.status !== 'PAID'
  ) {
    await payment.update({ status: 'PENDING_VERIFICATION', rejectionReason: null })
  } else if (
    PAID_GATED_STATUSES.includes(status) &&
    payment.status === 'UNPAID'
  ) {
    // Legacy rows: the appointment was already marked PAYMENT_VERIFIED while its payment
    // record stayed UNPAID. Entering a service state attests the verification — repair it.
    await payment.update({
      status: 'PAID',
      verifiedAt: new Date(),
      verifiedBy: adminId ?? null,
      rejectionReason: null,
    })
  }
}

function statusFieldsFor(status: AppointmentStatus): Record<string, unknown> {
  const now = new Date()
  switch (status) {
    case AppointmentStatusValue.IN_PROGRESS:
      return { serviceStartedAt: now }
    case AppointmentStatusValue.COMPLETED:
      return { completedAt: now }
    case AppointmentStatusValue.CANCELLED:
      return { cancelledAt: now }
    default:
      return {}
  }
}

export async function updateAppointmentStatus(
  id: number,
  status: AppointmentStatus,
  options: {
    cancellationReason?: string | null
    cancelledBy?: number | null
    updatedByAdminId?: number | null
  } = {},
): Promise<AppointmentPublic> {
  const appointment = await Appointment.findByPk(id)
  if (!appointment) {
    throw new NotFoundError('Appointment not found.')
  }

  const current = appointment.status as string
  if (!VALID_STATUSES.includes(current as AppointmentStatus)) {
    throw new UnprocessableError(
      `This appointment has an invalid status "${current}". Please contact support.`,
    )
  }

  if (current === AppointmentStatusValue.CANCELLED && status !== AppointmentStatusValue.CANCELLED) {
    throw new UnprocessableError(
      'This appointment has been cancelled. Please reactivate it before changing its status.',
    )
  }

  if (status === current) {
    return getAppointmentById(id)
  }

  if (!canTransition(current as AppointmentStatus, status)) {
    const suggestions = getValidNextStatuses(current as AppointmentStatus)
    const nextSteps = suggestions.length
      ? ` Available next steps: ${suggestions
          .map((next) => APPOINTMENT_STATUS_LABELS[next])
          .join(', ')}.`
      : ' This appointment is in a terminal state and its status can no longer change.'
    throw new UnprocessableError(
      `This appointment is currently ${APPOINTMENT_STATUS_LABELS[current as AppointmentStatus]} (${current}); it cannot move to ${APPOINTMENT_STATUS_LABELS[status]}.${nextSteps}`,
    )
  }

  if (PAID_GATED_STATUSES.includes(status)) {
    const payment = await Payment.findOne({ where: { appointmentId: id } })
    if (payment && (payment.status === 'REJECTED' || payment.status === 'CANCELLED')) {
      throw new UnprocessableError(
        `This payment was ${payment.status.toLowerCase()}, not verified. Verify the payment first (Payments page) or have the customer resubmit it before marking the appointment Ready for Service.`,
      )
    }
    // No payment record, UNPAID or PAID all pass: the appointment's own PAYMENT_VERIFIED
    // status is the authority, and legacy UNPAID drift is repaired after the update.
  }

  const fields: Record<string, unknown> = {
    status,
    ...statusFieldsFor(status),
  }
  if (status === AppointmentStatusValue.CANCELLED) {
    fields.cancellationReason = options.cancellationReason ?? null
    fields.cancelledBy = options.cancelledBy ?? null
  }

  await appointment.update(fields)

  if (status === AppointmentStatusValue.CANCELLED) {
    await markPaymentCancelled(id)
  } else {
    await syncPaymentForStatus(id, status, options.updatedByAdminId)
  }

  return getAppointmentById(id)
}

export async function reactivateAppointment(id: number): Promise<AppointmentPublic> {
  const appointment = await Appointment.findByPk(id)
  if (!appointment) {
    throw new NotFoundError('Appointment not found.')
  }
  if (appointment.status !== AppointmentStatusValue.CANCELLED) {
    return getAppointmentById(id)
  }

  const payment = await Payment.findOne({ where: { appointmentId: id } })
  const nextStatus: AppointmentStatus =
    payment?.status === 'PAID'
      ? AppointmentStatusValue.READY_FOR_SERVICE
      : AppointmentStatusValue.PAYMENT_REQUIRED

  await appointment.update({
    status: nextStatus,
    cancelledAt: null,
    cancellationReason: null,
    cancelledBy: null,
  })
  if (payment && payment.status === 'CANCELLED') {
    await payment.update({ status: 'UNPAID' })
  }

  return getAppointmentById(id)
}

export async function deleteAppointment(id: number): Promise<void> {
  const appointment = await Appointment.findByPk(id)
  if (!appointment) {
    throw new NotFoundError('Appointment not found.')
  }
  await appointment.destroy()
}