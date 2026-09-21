"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.minutesToHHmm = minutesToHHmm;
exports.hhmmToMinutes = hhmmToMinutes;
exports.getAvailableTimeSlots = getAvailableTimeSlots;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const appointmentStatuses_1 = require("../config/appointmentStatuses");
function minutesToHHmm(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
function hhmmToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/** Returns the list of bookable time slots for a barber on a given date. */
async function getAvailableTimeSlots(barberId, date, serviceDurationMinutes = 30) {
    const barber = await models_1.Barber.findByPk(barberId);
    if (!barber) {
        throw new Error('Barber not found.');
    }
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const availability = await models_1.BarberAvailability.findAll({
        where: { barberId, dayOfWeek, isAvailable: true },
    });
    if (availability.length === 0)
        return [];
    const window = {
        start: hhmmToMinutes(availability[0].startTime),
        end: hhmmToMinutes(availability[0].endTime),
    };
    const existing = await models_1.Appointment.findAll({
        where: {
            barberId,
            appointmentDate: date,
            status: { [sequelize_1.Op.ne]: appointmentStatuses_1.AppointmentStatusValue.CANCELLED },
        },
    });
    const serviceIds = [...new Set(existing.map((a) => a.serviceId))];
    const services = await models_1.Service.findAll({ where: { id: serviceIds } });
    const serviceMap = new Map(services.map((s) => [s.id, s.duration]));
    const bookings = existing.map((appointment) => {
        const start = hhmmToMinutes(appointment.appointmentTime);
        const duration = serviceMap.get(appointment.serviceId) ?? serviceDurationMinutes;
        return { start, end: start + duration };
    });
    const now = new Date();
    const isToday = date === toDateInput(now);
    const minStartToday = hhmmToMinutes(minutesToHHmm(now.getHours() * 60 + now.getMinutes()));
    const slots = [];
    for (let start = window.start; start + serviceDurationMinutes <= window.end; start += 30) {
        if (isToday && start < minStartToday)
            continue;
        const end = start + serviceDurationMinutes;
        const overlaps = bookings.some((booking) => start < booking.end && end > booking.start);
        slots.push({
            time: minutesToHHmm(start),
            endTime: minutesToHHmm(end),
            available: !overlaps,
        });
    }
    return slots;
}
//# sourceMappingURL=availabilityService.js.map