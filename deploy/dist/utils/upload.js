"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.MAX_IMAGE_SIZE_MB = void 0;
exports.uploadImageToCloudinary = uploadImageToCloudinary;
exports.deleteImageFromCloudinary = deleteImageFromCloudinary;
const multer_1 = __importDefault(require("multer"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const cloudinary_1 = require("../config/cloudinary");
const env_1 = require("../config/env");
const errors_1 = require("./errors");
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
exports.MAX_IMAGE_SIZE_MB = 5;
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: exports.MAX_IMAGE_SIZE_MB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(new errors_1.AppError('Only JPEG, PNG, WEBP, GIF and AVIF images are allowed.', 400));
        }
        cb(null, true);
    },
});
const PLACEHOLDER_VALUES = new Set(['your-cloud-name', 'your-api-key', 'your-api-secret']);
function credentialsConfigured() {
    return (Boolean(env_1.env.cloudinary.cloudName) &&
        Boolean(env_1.env.cloudinary.apiKey) &&
        Boolean(env_1.env.cloudinary.apiSecret) &&
        !PLACEHOLDER_VALUES.has(env_1.env.cloudinary.cloudName) &&
        !PLACEHOLDER_VALUES.has(env_1.env.cloudinary.apiKey) &&
        !PLACEHOLDER_VALUES.has(env_1.env.cloudinary.apiSecret));
}
async function uploadImageToCloudinary(buffer, folder) {
    if (!credentialsConfigured()) {
        throw new errors_1.AppError('Image upload is not configured. Add your real Cloudinary API key and secret to backend/.env, or paste an image URL instead of uploading a file.', 503);
    }
    const id = node_crypto_1.default.randomBytes(12).toString('hex');
    const result = await new Promise((resolve, reject) => {
        const stream = cloudinary_1.cloudinary.uploader.upload_stream({
            folder: folder ?? env_1.env.cloudinary.uploadFolder,
            public_id: id,
            resource_type: 'image',
            transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        }, (error, uploadResult) => {
            if (error)
                reject(error);
            else if (uploadResult)
                resolve(uploadResult);
            else
                reject(new Error('Cloudinary returned no result'));
        });
        stream.end(buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
}
async function deleteImageFromCloudinary(publicId) {
    if (!publicId)
        return;
    await cloudinary_1.cloudinary.uploader.destroy(publicId);
}
//# sourceMappingURL=upload.js.map