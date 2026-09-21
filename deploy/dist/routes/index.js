"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_1 = require("./auth");
const services_1 = require("./services");
const barbers_1 = require("./barbers");
const appointments_1 = require("./appointments");
const availability_1 = require("./availability");
const gallery_1 = require("./gallery");
const reviews_1 = require("./reviews");
const contact_1 = require("./contact");
const dashboard_1 = require("./dashboard");
const customers_1 = require("./customers");
const customerAuth_1 = require("./customerAuth");
const customerMe_1 = require("./customerMe");
const payments_1 = require("./payments");
const paystack_1 = require("./paystack");
const adminPayments_1 = require("./adminPayments");
const adminPaymentSettings_1 = require("./adminPaymentSettings");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.use('/auth', auth_1.authRouter);
exports.apiRouter.use('/services', services_1.servicesRouter);
exports.apiRouter.use('/barbers', barbers_1.barbersRouter);
exports.apiRouter.use('/appointments', appointments_1.appointmentsRouter);
exports.apiRouter.use('/availability', availability_1.availabilityRouter);
exports.apiRouter.use('/gallery', gallery_1.galleryRouter);
exports.apiRouter.use('/reviews', reviews_1.reviewsRouter);
exports.apiRouter.use('/contact', contact_1.contactRouter);
exports.apiRouter.use('/account', customerAuth_1.customerAuthRouter);
exports.apiRouter.use('/account', customerMe_1.customerMeRouter);
// Paystack sub-router MUST be mounted before paymentsRouter:
// paymentsRouter has POST /:token/... patterns that would otherwise
// swallow /payments/paystack/* paths with token="paystack".
exports.apiRouter.use('/payments/paystack', paystack_1.paystackRouter);
exports.apiRouter.use('/payments', payments_1.paymentsRouter);
exports.apiRouter.use('/admin/dashboard', dashboard_1.dashboardRouter);
exports.apiRouter.use('/admin/customers', customers_1.customersRouter);
exports.apiRouter.use('/admin/payments', adminPayments_1.adminPaymentsRouter);
exports.apiRouter.use('/admin/payment-settings', adminPaymentSettings_1.adminPaymentSettingsRouter);
//# sourceMappingURL=index.js.map