"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerAuthRouter = void 0;
const express_1 = require("express");
const customerAuthController_1 = require("../controllers/customerAuthController");
const customerAuth_1 = require("../middleware/customerAuth");
const validate_1 = require("../middleware/validate");
const customerAuth_2 = require("../validators/customerAuth");
exports.customerAuthRouter = (0, express_1.Router)();
/**
 * @swagger
 * /api/account/otp/request:
 *   post:
 *     tags: [Account]
 *     summary: Request a login OTP (public)
 *     description: Sends a 6-digit code to the customer's saved email. Only existing accounts receive codes.
 */
exports.customerAuthRouter.post('/otp/request', (0, validate_1.validate)(customerAuth_2.customerOtpRequestSchema), customerAuthController_1.requestOtpHandler);
/**
 * @swagger
 * /api/account/otp/verify:
 *   post:
 *     tags: [Account]
 *     summary: Verify OTP and login (public)
 */
exports.customerAuthRouter.post('/otp/verify', (0, validate_1.validate)(customerAuth_2.customerOtpVerifySchema), customerAuthController_1.verifyOtpHandler);
/**
 * @swagger
 * /api/account/register:
 *   post:
 *     tags: [Account]
 *     summary: Create a customer account (public)
 *     description: One account per phone number; legacy guest records are upgraded, never duplicated.
 */
exports.customerAuthRouter.post('/register', (0, validate_1.validate)(customerAuth_2.customerRegisterSchema), customerAuthController_1.registerHandler);
/**
 * @swagger
 * /api/account/login:
 *   post:
 *     tags: [Account]
 *     summary: Login with phone + password (public)
 */
exports.customerAuthRouter.post('/login', (0, validate_1.validate)(customerAuth_2.customerLoginPasswordSchema), customerAuthController_1.loginPasswordHandler);
exports.customerAuthRouter.get('/me', customerAuth_1.requireCustomer, customerAuthController_1.meHandler);
exports.customerAuthRouter.patch('/me', customerAuth_1.requireCustomer, (0, validate_1.validate)(customerAuth_2.customerProfileUpdateSchema), customerAuthController_1.updateProfileHandler);
exports.customerAuthRouter.post('/me/password', customerAuth_1.requireCustomer, (0, validate_1.validate)(customerAuth_2.customerPasswordChangeSchema), customerAuthController_1.changePasswordHandler);
exports.customerAuthRouter.get('/booking-prefill', customerAuth_1.requireCustomer, customerAuthController_1.prefillHandler);
//# sourceMappingURL=customerAuth.js.map