import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import heicConvert from 'heic-convert'

/**
 * Converts the supplied media to web-ready JPEG/MP4 and writes a manifest used
 * by the database update step. Originals are untouched.
 */

const FF = path.resolve('node_modules/ffmpeg-static/ffmpeg.exe')
const OUT = path.resolve('backend/uploads/media')
const SRC = {
  gallery: "C:/Users/Halifa Shu'aibu/Desktop/galary",
  payment: "C:/Users/Halifa Shu'aibu/Downloads/payment",
  product: "C:/Users/Halifa Shu'aibu/Downloads/product",
}
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif'])
const BUCKETS = ['gallery', 'barbers', 'services', 'products', 'payment']
for (const bucket of BUCKETS) mkdirSync(path.join(OUT, bucket), { recursive: true })
const TMP = path.join(OUT, '_tmp')
mkdirSync(TMP, { recursive: true })

function ff(args) {
  return execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function listFiles(dir) {
  if (!readdirSync) return []
  return readdirSync(dir)
    .filter((name) => statSync(path.join(dir, name)).isFile())
    .map((name) => path.join(dir, name))
}

async function toJpeg(source, dest) {
  const ext = path.extname(source).toLowerCase()
  let input = source
  let temp = null
  if (ext === '.heic' || ext === '.heif') {
    const buffer = readFileSync(source)
    const jpeg = await heicConvert({ buffer, format: 'JPEG', quality: 0.86 })
    temp = path.join(TMP, `${slug(path.basename(source))}.jpg`)
    writeFileSync(temp, jpeg)
    input = temp
  }
  ff(['-y', '-i', input, '-vf', "scale='min(1600,iw)':-2", '-q:v', '3', '-frames:v', '1', dest])
  if (temp) rmSync(temp, { force: true })
}

function toMp4(source, dest, poster) {
  ff([
    '-y', '-i', source,
    '-vf', "scale='min(1280,iw)':-2",
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    dest,
  ])
  ff(['-y', '-ss', '1', '-i', source, '-vf', "scale='min(1280,iw)':-2", '-frames:v', '1', '-q:v', '3', poster])
}

function titleFor(name) {
  const stem = path.basename(name).replace(/\.[^.]+$/, '')
  const clean = stem.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (/^img[ _-]?\d+/i.test(clean)) return 'Sawaba Look'
  if (/lou ?cut/i.test(clean)) return 'Low Cut'
  if (/face ?trea/i.test(clean)) return 'Face Treatment'
  if (/ya sayyadi/i.test(clean)) return 'Ya Sayyadi'
  return clean.replace(/\b\w/g, (c) => c.toUpperCase())
}

function categoryFor(name) {
  const text = path.basename(name).toLowerCase()
  if (/fade|low ?cut|loucut|cabbing/.test(text)) return 'FADE'
  if (/face|treatment|salon/.test(text)) return 'SALON'
  if (/style|fastion|fashion/.test(text)) return 'STYLING'
  if (/beard/.test(text)) return 'BEARD'
  if (/kid/.test(text)) return 'KIDS'
  return 'HAIRCUT'
}

async function main() {
  // ── Gallery images ────────────────────────────────────────────────────────
  const galleryFiles = listFiles(SRC.gallery)
    .filter((file) => IMAGE_EXT.has(path.extname(file).toLowerCase()))
    .sort((a, b) => {
      const priority = (file) => {
        const text = path.basename(file).toLowerCase()
        if (/sayyid|loua|ya sayyadi|style|fastion|cabbing/.test(text)) return 0
        if (/low ?cut|loucut|face/.test(text)) return 1
        if (/^img/.test(text)) return 2
        return 3
      }
      return priority(a) - priority(b) || path.basename(a).localeCompare(path.basename(b))
    })

  const gallery = []
  for (let index = 0; index < galleryFiles.length; index += 1) {
    const file = galleryFiles[index]
    const name = `gallery-${String(index + 1).padStart(2, '0')}-${slug(path.basename(file))}.jpg`
    const dest = path.join(OUT, 'gallery', name)
    await toJpeg(file, dest)
    gallery.push({
      url: `/uploads/media/gallery/${name}`,
      title: titleFor(file),
      category: categoryFor(file),
      mediaType: 'IMAGE',
    })
  }

  const movFile = listFiles(SRC.gallery).find((file) => /\.mov$/i.test(file))
  if (movFile) {
    const mp4 = path.join(OUT, 'gallery', 'gallery-video-01.mp4')
    const poster = path.join(OUT, 'gallery', 'gallery-video-01-poster.jpg')
    toMp4(movFile, mp4, poster)
    gallery.push({
      url: '/uploads/media/gallery/gallery-video-01-poster.jpg',
      video: '/uploads/media/gallery/gallery-video-01.mp4',
      title: 'Studio in Motion',
      category: 'SALON',
      mediaType: 'VIDEO',
      duration: 9,
    })
  }

  // ── Barbers (first 7) and services (next 13, cycling) ───────────────────
  const barbers = []
  for (let i = 0; i < 7; i += 1) {
    const source = path.join(OUT, 'gallery', path.basename(gallery[i % gallery.length].url))
    const name = `barber-${String(i + 1).padStart(2, '0')}.jpg`
    copyFileSync(source, path.join(OUT, 'barbers', name))
    barbers.push(`/uploads/media/barbers/${name}`)
  }

  const imageGallery = gallery.filter((item) => item.mediaType === 'IMAGE')
  const services = []
  for (let i = 0; i < 13; i += 1) {
    const source = path.join(OUT, 'gallery', path.basename(imageGallery[i % imageGallery.length].url))
    const name = `service-${String(i + 1).padStart(2, '0')}.jpg`
    copyFileSync(source, path.join(OUT, 'services', name))
    services.push(`/uploads/media/services/${name}`)
  }

  // ── Payment logo (single field) ──────────────────────────────────────────
  const paymentFiles = listFiles(SRC.payment)
    .filter((file) => IMAGE_EXT.has(path.extname(file).toLowerCase()))
    .sort()
  let paymentLogo = null
  if (paymentFiles.length > 0) {
    paymentLogo = '/uploads/media/payment/shop-logo.jpg'
    await toJpeg(paymentFiles[0], path.join(OUT, 'payment', 'shop-logo.jpg'))
  }

  // ── Products (grouped from the supplied photos) ──────────────────────────
  const productFiles = listFiles(SRC.product)
  const pick = (pattern) => productFiles.filter((file) => pattern.test(path.basename(file)))
  const numbered = (from, to) =>
    productFiles.filter((file) => {
      const match = path.basename(file).match(/^images \((\d+)\)/i)
      return match && Number(match[1]) >= from && Number(match[1]) <= to
    })

  const groups = [
    {
      name: 'Professional Cordless Hair Clipper',
      description: 'Cordless clipper and trimmer set available from the Sawaba marketplace.',
      price: 24500,
      categoryName: 'Clippers & Trimmers',
      files: [...pick(/Professional-Mens-Hair-Clippers/i), ...numbered(4, 9)],
    },
    {
      name: 'MG-7T Hair Trimmer',
      description: 'Compact grooming trimmer available from the Sawaba marketplace.',
      price: 18000,
      categoryName: 'Clippers & Trimmers',
      files: [...pick(/MG_7T/i), ...numbered(10, 12)],
    },
    {
      name: 'Oraimo OPC-CL30G Cordless Clipper',
      description: 'Oraimo cordless grooming clipper available from the Sawaba marketplace.',
      price: 32000,
      categoryName: 'Clippers & Trimmers',
      files: [...pick(/oraimo/i), ...pick(/s-l1600/i), ...numbered(13, 15)],
    },
  ]

  const products = []
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex]
    const images = []
    for (let index = 0; index < group.files.length; index += 1) {
      const file = group.files[index]
      const name = `product-${groupIndex + 1}-${String(index + 1).padStart(2, '0')}-${slug(path.basename(file))}.jpg`
      await toJpeg(file, path.join(OUT, 'products', name))
      images.push(`/uploads/media/products/${name}`)
    }
    products.push({
      name: group.name,
      description: group.description,
      price: group.price,
      categoryName: group.categoryName,
      images,
    })
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    gallery,
    barbers,
    services,
    paymentLogo,
    products,
  }
  const manifestPath = path.resolve('promo/media-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

  console.log(`gallery images: ${imageGallery.length}, video: ${movFile ? 1 : 0}`)
  console.log(`barbers: ${barbers.length}, services: ${services.length}`)
  console.log(`payment logo: ${paymentLogo}`)
  console.log(`products: ${products.map((p) => `${p.name} (${p.images.length})`).join(', ')}`)
  console.log(`manifest: ${manifestPath}`)
}

main().catch((error) => {
  console.error('[convert] failed:', error)
  process.exitCode = 1
})
