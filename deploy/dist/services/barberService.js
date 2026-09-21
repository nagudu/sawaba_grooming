"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeBarber = serializeBarber;
exports.createBarber = createBarber;
exports.listBarbers = listBarbers;
exports.getBarberById = getBarberById;
exports.updateBarber = updateBarber;
exports.deleteBarber = deleteBarber;
exports.countBarberAppointments = countBarberAppointments;
exports.getBarberAvailability = getBarberAvailability;
exports.upsertBarberAvailability = upsertBarberAvailability;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const errors_1 = require("../utils/errors");
const response_1 = require("../utils/response");
const slug_1 = require("../utils/slug");
function serializeBarber(barber, includeServices = false) {
    const base = {
        id: barber.id,
        name: barber.name,
        slug: barber.slug,
        image: barber.image,
        phone: barber.phone,
        email: barber.email,
        specialty: barber.specialty,
        biography: barber.biography,
        experience: barber.experience,
        rating: Number(barber.rating),
        isActive: barber.isActive,
        createdAt: barber.createdAt,
        updatedAt: barber.updatedAt,
    };
    if (includeServices && barber.services) {
        base.services = barber.services.map((service) => ({
            id: service.id,
            name: service.name,
            slug: service.slug,
            price: Number(service.price),
            duration: service.duration,
        }));
    }
    return base;
}
const serviceScope = {
    include: [
        {
            model: models_1.Service,
            as: 'services',
            through: { attributes: [] },
        },
    ],
};
async function uniqueSlug(name, excludeId) {
    const base = (0, slug_1.slugify)(name);
    let candidate = base;
    let counter = 2;
    while (true) {
        const existing = await models_1.Barber.findOne({
            where: excludeId
                ? { slug: candidate, id: { [sequelize_1.Op.not]: excludeId } }
                : { slug: candidate },
        });
        if (!existing)
            return candidate;
        candidate = `${base}-${counter}`;
        counter += 1;
    }
}
async function createBarber(input) {
    const { serviceIds, ...data } = input;
    const slug = await uniqueSlug(data.name);
    const barber = await models_1.Barber.create({ ...data, slug });
    if (serviceIds && serviceIds.length > 0) {
        await barber.setServices(serviceIds);
    }
    return getBarberById(barber.id);
}
async function listBarbers(query) {
    const { page, perPage, offset, limit } = (0, response_1.getPagination)(query);
    const includeInactive = query.includeInactive === 'true';
    const where = {
        ...(!includeInactive
            ? { isActive: true }
            : query.isActive
                ? { isActive: query.isActive === 'true' }
                : {}),
        ...(query.search
            ? {
                [sequelize_1.Op.or]: [
                    { name: { [sequelize_1.Op.like]: `%${query.search}%` } },
                    { slug: { [sequelize_1.Op.like]: `%${query.search}%` } },
                    { specialty: { [sequelize_1.Op.like]: `%${query.search}%` } },
                    { biography: { [sequelize_1.Op.like]: `%${query.search}%` } },
                ],
            }
            : {}),
    };
    const { rows, count } = await models_1.Barber.findAndCountAll({
        where,
        include: [
            {
                model: models_1.Service,
                as: 'services',
                through: { attributes: [] },
                // When filtering by serviceId, use INNER JOIN (required: true) so only
                // barbers assigned to that service are returned.
                // Without a serviceId filter, use LEFT JOIN (required: false) so barbers
                // with no service assignments still appear in the list.
                ...(query.serviceId
                    ? { where: { id: query.serviceId }, required: true }
                    : { required: false }),
            },
        ],
        distinct: true,
        order: [['name', 'ASC']],
        offset,
        limit,
    });
    const items = rows.map((barber) => serializeBarber(barber, true));
    if (includeInactive) {
        const countRows = await models_1.Appointment.findAll({
            attributes: ['barberId', [(0, sequelize_1.fn)('COUNT', (0, sequelize_1.col)('Appointment.id')), 'count']],
            group: ['barberId'],
            raw: true,
        });
        const countMap = new Map();
        for (const row of countRows) {
            countMap.set(row.barberId, Number(row.count));
        }
        for (const item of items) {
            const total = countMap.get(item.id);
            if (typeof total === 'number')
                item.appointmentCount = total;
        }
    }
    return {
        items,
        total: count,
        page,
        perPage,
    };
}
async function getBarberById(id) {
    const barber = await models_1.Barber.findByPk(id, serviceScope);
    if (!barber) {
        throw new errors_1.NotFoundError('Barber not found.');
    }
    return serializeBarber(barber, true);
}
async function updateBarber(id, input) {
    const barber = await models_1.Barber.findByPk(id);
    if (!barber) {
        throw new errors_1.NotFoundError('Barber not found.');
    }
    const { serviceIds, ...data } = input;
    if (Object.keys(data).length > 0) {
        const changes = { ...data };
        if (data.name && data.name !== barber.name) {
            changes.slug = await uniqueSlug(data.name, id);
        }
        await barber.update(changes);
    }
    if (serviceIds) {
        await barber.setServices(serviceIds);
    }
    return getBarberById(id);
}
/**
 * Permanently removes a barber together with their availability slots and
 * service links. Only safe for barbers with NO appointment history — the
 * controller checks that first and deactivates instead when history exists.
 */
async function deleteBarber(id) {
    const barber = await models_1.Barber.findByPk(id);
    if (!barber) {
        throw new errors_1.NotFoundError('Barber not found.');
    }
    await models_1.BarberService.destroy({ where: { barberId: id } });
    await models_1.BarberAvailability.destroy({ where: { barberId: id } });
    await barber.destroy();
}
async function countBarberAppointments(id) {
    return models_1.Appointment.count({ where: { barberId: id } });
}
async function getBarberAvailability(barberId) {
    const barber = await models_1.Barber.findByPk(barberId);
    if (!barber) {
        throw new errors_1.NotFoundError('Barber not found.');
    }
    return models_1.BarberAvailability.findAll({
        where: { barberId },
        order: [['dayOfWeek', 'ASC']],
    });
}
async function upsertBarberAvailability(barberId, entries) {
    const barber = await models_1.Barber.findByPk(barberId);
    if (!barber) {
        throw new errors_1.NotFoundError('Barber not found.');
    }
    for (const entry of entries) {
        const [record] = await models_1.BarberAvailability.findOrCreate({
            where: { barberId, dayOfWeek: entry.dayOfWeek },
            defaults: { ...entry, barberId },
        });
        await record.update({
            startTime: entry.startTime,
            endTime: entry.endTime,
            isAvailable: entry.isAvailable ?? true,
        });
    }
    return getBarberAvailability(barberId);
}
//# sourceMappingURL=barberService.js.map