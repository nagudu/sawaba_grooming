import { Jimp } from 'jimp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * Generates the PWA / mobile install icons from a simple vector-style mark
 * (gold ring + blade) so Android and iOS get real PNG icons instead of the
 * single SVG. Run with `npm run pwa:icons`.
 */

const OUT_DIR = path.resolve('public/icons')
const DARK = 0x0a0a0cff
const GOLD = 0xd4af37ff

function setPixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.bitmap.width || y >= image.bitmap.height) return
  image.setPixelColor(color, x, y)
}

function drawRing(image, radius, ring, color, centerScale) {
  const cx = image.bitmap.width / 2
  const cy = image.bitmap.height / 2
  const outer = image.bitmap.width * centerScale
  const inner = outer - ring
  for (let y = 0; y < image.bitmap.height; y += 1) {
    for (let x = 0; x < image.bitmap.width; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= outer && distance >= inner) setPixel(image, x, y, color)
    }
  }
  void radius
}

function drawLine(image, x0, y0, x1, y1, thickness, color) {
  const steps = Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2)
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps
    const x = Math.round(x0 + (x1 - x0) * t)
    const y = Math.round(y0 + (y1 - y0) * t)
    for (let oy = -thickness; oy <= thickness; oy += 1) {
      for (let ox = -thickness; ox <= thickness; ox += 1) setPixel(image, x + ox, y + oy, color)
    }
  }
}

async function makeIcon(size, filename, { maskable = false } = {}) {
  const image = new Jimp({ width: size, height: size, color: DARK })
  const inner = maskable ? 0.3 : 0.4
  const ring = Math.max(3, Math.round(size * 0.05))
  drawRing(image, 0, ring, GOLD, inner)
  const cx = size / 2
  const cy = size / 2
  const arm = size * (maskable ? 0.14 : 0.18)
  drawLine(
    image,
    cx - arm,
    cy + arm,
    cx + arm,
    cy - arm,
    Math.max(1, Math.round(size * 0.014)),
    GOLD,
  )
  await image.write(path.join(OUT_DIR, filename))
  console.log(`[icons] wrote ${filename} (${size}x${size})`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  await makeIcon(192, 'icon-192.png')
  await makeIcon(512, 'icon-512.png')
  await makeIcon(512, 'maskable-512.png', { maskable: true })
  await makeIcon(180, 'apple-touch-icon.png')
}

main().catch((error) => {
  console.error('[icons] failed:', error)
  process.exitCode = 1
})
