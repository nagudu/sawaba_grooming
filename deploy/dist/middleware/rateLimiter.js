"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = require("express-rate-limit");
const defaultConfig = {
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests. Please try again later.',
    },
};
/** General API limiter: 300 requests per 15 minutes per IP. */
exports.apiLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    ...defaultConfig,
});
/** Stricter limiter for authentication endpoints: 10 attempts per 15 minutes. */
exports.authLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    ...defaultConfig,
});
/** Limiter for public submission endpoints (bookings, contact, reviews). */
exports.submitLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    ...defaultConfig,
});
//# sourceMappingURL=rateLimiter.js.map