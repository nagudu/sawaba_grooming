import { sequelize } from '../config/database'
import { Appointment, Barber, BarberAssignmentHistory, BarberEarning } from '../models'
import { NotFoundError, UnprocessableError } from '../utils/errors'
import { getAppointmentById } from './appointmentService'
import { createEarningSnapshot } from './commissionService'
import type { AssignBarberInput } from '../validators/barberEarning'
import type { AppointmentPublic } from './appointmentService'

/**
 * Admin barber assignment (requirement #5/#6).
 *
 * The customer's booked barber always stays on `barberId` — `assignedBarberId`
 * records the barber admin actually assigns. Admin has FINAL authority:
 * customers can never modify these fields (the customer-facing endpoints and
 * serializers never accept or expose them).
 */

export async function getAssignmentHistory(appointmentId: number) {
  const appointment = await Appointment.findByPk(appointmentId)
  if (!appointment) {
    throw new NotFoundError('Appointment not found.')
  }
  const rows = await BarberAssignmentHistory.findAll({
    where: { appointmentId },
    include: [
      { model: Barber, as: 'previousBarber', attributes: ['id', 'name'] },
      { model: Barber, as: 'newBarber', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC']],
  })
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    previousBarber: row.previousBarber ? { id: row.previousBarber.id, name: row.previousBarber.name } : null,
    newBarber: row.newBarber ? { id: row.newBarber.id, name: row.newBarber.name } : null,
    reason: row.reason,
    createdAt: row.createdAt,
  }))
}

export async function assignBarber(
  appointmentId: number,
  input: AssignBarberInput,
  adminId: number | null,
): Promise<AppointmentPublic> {
  const appointment = await Appointment.findByPk(appointmentId)
  if (!appointment) {
    throw new NotFoundError('Appointment not found.')
  }
  if (appointment.status === 'CANCELLED') {
    throw new UnprocessableError('Cancelled bookings cannot be reassigned. Reactivate the booking first.')
  }

  if (input.barberId !== null) {
    const barber = await Barber.findByPk(input.barberId)
    if (!barber) {
      throw new NotFoundError('Selected barber not found.')
    }
    if (!barber.isActive) {
      throw new UnprocessableError('The selected barber is inactive.')
    }
  }

  const currentAssignment = appointment.assignedBarberId ?? null
  const effectiveCurrent = currentAssignment ?? appointment.barberId
  const next = input.barberId // null = remove assignment (fall back to booked barber)

  if (next === effectiveCurrent) {
    // No-op — keep it idempotent.
    return getAppointmentById(appointmentId)
  }

  const action = next === null ? 'REMOVED' : currentAssignment === null ? 'ASSIGNED' : 'REASSIGNED'

  await sequelize.transaction(async (t) => {
    await appointment.update(
      {
        assignedBarberId: next,
        assignedAt: next ? new Date() : null,
        assignedBy: next ? adminId : null,
      },
      { transaction: t },
    )

    await BarberAssignmentHistory.create(
      {
        appointmentId,
        previousBarberId: effectiveCurrent,
        newBarberId: next,
        action,
        reason: input.reason?.trim() || null,
        changedByAdminId: adminId,
      },
      { transaction: t },
    )

    // The earning must follow the barber who will actually perform the work.
    // Re-snapshot with the NEW barber's CURRENT config; a PAID row is left
    // alone (money already settled against the old barber).
    const earning = await BarberEarning.findOne({ where: { appointmentId }, transaction: t })
    if (next !== null && (!earning || earning.status !== 'PAID')) {
      if (earning) await earning.destroy({ transaction: t })
      await createEarningSnapshot(
        appointmentId,
        next,
        Number(appointment.totalAmount),
        t,
      )
    }
  })

  return getAppointmentById(appointmentId)
}
