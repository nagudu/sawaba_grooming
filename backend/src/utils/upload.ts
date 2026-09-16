import type { UploadApiResponse } from 'cloudinary'
import multer from 'multer'
import crypto from 'node:crypto'
import { cloudinary } from '../config/cloudinary'
import { env } from '../config/env'
import { AppError } from './errors'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
export const MAX_IMAGE_SIZE_MB = 5

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError('Only JPEG, PNG, WEBP, GIF and AVIF images are allowed.', 400))
    }
    cb(null, true)
  },
})

export interface UploadedImage {
  url: string
  publicId: string
}

const PLACEHOLDER_VALUES = new Set(['your-cloud-name', 'your-api-key', 'your-api-secret'])

function credentialsConfigured(): boolean {
  return (
    Boolean(env.cloudinary.cloudName) &&
    Boolean(env.cloudinary.apiKey) &&
    Boolean(env.cloudinary.apiSecret) &&
    !PLACEHOLDER_VALUES.has(env.cloudinary.cloudName) &&
    !PLACEHOLDER_VALUES.has(env.cloudinary.apiKey) &&
    !PLACEHOLDER_VALUES.has(env.cloudinary.apiSecret)
  )
}

export async function uploadImageToCloudinary(buffer: Buffer, folder?: string): Promise<UploadedImage> {
  if (!credentialsConfigured()) {
    throw new AppError(
      'Image upload is not configured. Add your real Cloudinary API key and secret to backend/.env, or paste an image URL instead of uploading a file.',
      503,
    )
  }

  const id = crypto.randomBytes(12).toString('hex')

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder ?? env.cloudinary.uploadFolder,
        public_id: id,
        resource_type: 'image',
        transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (error, uploadResult) => {
        if (error) reject(error)
        else if (uploadResult) resolve(uploadResult)
        else reject(new Error('Cloudinary returned no result'))
      },
    )
    stream.end(buffer)
  })

  return { url: result.secure_url, publicId: result.public_id }
}

export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return
  await cloudinary.uploader.destroy(publicId)
}