"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBarberHandler = createBarberHandler;
exports.listBarbersHandler = listBarbersHandler;
exports.getBarberByIdHandler = getBarberByIdHandler;
exports.updateBarberHandler = updateBarberHandler;
exports.deleteBarberHandler = deleteBarberHandler;
exports.getAvailabilityHandler = getAvailabilityHandler;
exports.setAvailabilityHandler = setAvailabilityHandler;
const barberService_1 = require("../services/barberService");
const response_1 = require("../utils/response");
const models_1 = require("../models");
const upload_1 = require("../utils/upload");
const errors_1 = require("../utils/errors");
async function withUploadedImage(req, next, fallback) {
    const file = req.file;
    if (!file)
        return fallback;
    try {
        const uploaded = await (0, upload_1.uploadImageToCloudinary)(file.buffer, 'sawaba-barbers');
        return uploaded.url;
    }
    catch (error) {
        next(new errors_1.AppError('Image upload failed. Please try again.', 500));
        return undefined;
    }
}
async function createBarberHandler(req, res, next) {
    try {
        const image = await withUploadedImage(req, next, req.body.image ?? null);
        if (image === undefined)
            return;
        const input = { ...req.body, image };
        const barber = await (0, barberService_1.createBarber)(input);
        (0, response_1.successRes)(res, 'Barber created successfully.', barber, 201);
    }
    catch (error) {
        next(error);
    }
}
async function listBarbersHandler(req, res, next) {
    try {
        const query = req.query;
        const result = await (0, barberService_1.listBarbers)(query);
        (0, response_1.successRes)(res, 'Barbers retrieved.', result, 200);
    }
    catch (error) {
        next(error);
    }
}
async function getBarberByIdHandler(req, res, next) {
    try {
        const barber = await (0, barberService_1.getBarberById)(Number(req.params.id));
        (0, response_1.successRes)(res, 'Barber retrieved.', barber, 200);
    }
    catch (error) {
        next(error);
    }
}
async function updateBarberHandler(req, res, next) {
    try {
        const id = Number(req.params.id);
        const existing = await (0, barberService_1.getBarberById)(id);
        const image = await withUploadedImage(req, next, req.body.image ?? existing.image);
        if (image === undefined)
            return;
        const input = { ...req.body, image };
        const barber = await (0, barberService_1.updateBarber)(id, input);
        (0, response_1.successRes)(res, 'Barber updated successfully.', barber, 200);
    }
    catch (error) {
        next(error);
    }
}
async function deleteBarberHandler(req, res, next) {
    try {
        const id = Number(req.params.id);
        const existing = await (0, barberService_1.getBarberById)(id);
        const appointmentCount = await (0, barberService_1.countBarberAppointments)(id);
        if (appointmentCount > 0) {
            // The barber keeps old appointments/receipts consistent, so they cannot
            // be physically removed — deactivate them instead and say so honestly.
            const [updatedCount] = await models_1.Barber.update({ isActive: false }, { where: { id } });
            if (updatedCount === 0) {
                throw new errors_1.NotFoundError('Barber not found.');
            }
            (0, response_1.successRes)(res, `"${existing.name}" has ${appointmentCount} appointment${appointmentCount === 1 ? '' : 's'} on record, so they were deactivated instead of deleted. Their past bookings and receipts stay intact — remove them from services in Edit if you no longer offer those combinations.`, { deactivated: true, appointmentCount }, 200);
            return;
        }
        await (0, barberService_1.deleteBarber)(id);
        if (existing.image && existing.image.includes('cloudinary')) {
            await (0, upload_1.deleteImageFromCloudinary)(existing.image.split('/').pop()?.split('.')[0] ?? '').catch(() => undefined);
        }
        (0, response_1.successRes)(res, 'Barber deleted successfully.', { deactivated: false }, 200);
    }
    catch (error) {
        next(error);
    }
}
async function getAvailabilityHandler(req, res, next) {
    try {
        const availability = await (0, barberService_1.getBarberAvailability)(Number(req.params.id));
        (0, response_1.successRes)(res, 'Barber availability retrieved.', availability, 200);
    }
    catch (error) {
        next(error);
    }
}
async function setAvailabilityHandler(req, res, next) {
    try {
        const barberId = Number(req.params.id);
        const entries = Array.isArray(req.body) ? req.body : [req.body];
        const result = await (0, barberService_1.upsertBarberAvailability)(barberId, entries);
        (0, response_1.successRes)(res, 'Barber availability updated.', result, 200);
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=barberController.js.map