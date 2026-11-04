import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const FF = path.resolve('node_modules/ffmpeg-static/ffmpeg.exe')
const MASTER = path.resolve('promo/sawaba-promo-16x9.mp4')
const MARKETING = path.resolve('promo/marketing')
const CARDS = path.join(MARKETING, 'cards')
const SCREENS = path.join(MARKETING, 'screens')
mkdirSync(CARDS, { recursive: true })
mkdirSync(SCREENS, { recursive: true })

function ff(args) {
  return execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// ── Vertical 9:16 social cut (landscape centred on a blurred fill) ───────────
const vertical = path.resolve('promo/sawaba-promo-9x16.mp4')
if (!existsSync(vertical)) {
  ff([
    '-i', MASTER,
    '-filter_complex',
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:4,eq=brightness=-0.10[bg];` +
      `[0:v]scale=1080:-2[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p[v]`,
    '-map', '[v]', '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart',
    vertical,
  ])
}
console.log('vertical:', vertical, `${(statSync(vertical).size / 1024 / 1024).toFixed(1)} MB`)

// ── Branded square marketing cards ──────────────────────────────────────────
const CARDS_DEF = [
  { image: '02-services.png', headline: 'Book your next cut' },
  { image: '03-barbers.png', headline: 'Choose your barber' },
  { image: '05-shop.png', headline: 'Shop the marketplace' },
  { image: '06-product.png', headline: 'Product details & videos' },
  { image: '29-vendor-wallet.png', headline: 'Vendor wallet & payouts' },
  { image: '22-admin-pickup.png', headline: 'Verify pickup in seconds' },
]
const headFont = "C\\:/Windows/Fonts/georgia.ttf"
const smallFont = "C\\:/Windows/Fonts/seguisb.ttf"

for (let index = 0; index < CARDS_DEF.length; index += 1) {
  const card = CARDS_DEF[index]
  const input = path.join(path.resolve('promo/shots'), card.image)
  const output = path.join(CARDS, `${String(index + 1).padStart(2, '0')}-${card.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`)
  ff([
    '-i', input,
    '-vf',
    `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,` +
      `drawbox=x=0:y=858:w=1080:h=222:color=0x0a0a0c@0.86:t=fill,` +
      `drawbox=x=0:y=858:w=1080:h=4:color=0xd4af37@0.9:t=fill,` +
      `drawtext=fontfile='${smallFont}':text='SAWABA GROOMING STUDIO':fontcolor=0xd4af37:fontsize=22:x=60:y=900,` +
      `drawtext=fontfile='${headFont}':text='${card.headline}':fontcolor=0xffffff:fontsize=52:x=60:y=948`,
    '-frames:v', '1',
    output,
  ])
}
console.log('cards:', CARDS_DEF.length)

// ── Curated high-resolution screenshots for marketing ───────────────────────
const CURATED = [
  '01-home.png',
  '02-services.png',
  '03-barbers.png',
  '04-booking.png',
  '05-shop.png',
  '06-product.png',
  '08-cart.png',
  '09-checkout.png',
  '11-customer-dashboard.png',
  '13-order-detail.png',
  '15-admin-dashboard.png',
  '16-admin-appointments.png',
  '20-admin-marketplace.png',
  '22-admin-pickup.png',
  '24-barber-dashboard.png',
  '26-vendor-dashboard.png',
  '27-vendor-products.png',
  '29-vendor-wallet.png',
  '31-mobile-shop.png',
  '32-mobile-product.png',
  '35-admin-shop-payments.png',
  '37-customer-payments.png',
]
for (const name of CURATED) {
  const source = path.join(path.resolve('promo/shots'), name)
  if (existsSync(source)) copyFileSync(source, path.join(SCREENS, name))
}
console.log('screens:', CURATED.length)

writeFileSync(
  path.join(MARKETING, 'README.md'),
  `# Sawaba Grooming Studio — marketing assets\n\n` +
    `All assets were captured from the running application (real screens, no mock-ups).\n\n` +
    `- \`../sawaba-promo-16x9.mp4\` — 1920x1080 master with voice-over, subtitles and music\n` +
    `- \`../sawaba-promo-9x16.mp4\` — 1080x1920 cut for WhatsApp / Instagram / TikTok\n` +
    `- \`cards/\` — six branded square promo cards (1080x1080)\n` +
    `- \`screens/\` — curated full-resolution screenshots (desktop + mobile)\n\n` +
    `Tagline: **Sawaba Grooming Studio – Your Grooming, Your Shopping, All in One Place.**\n`,
  'utf8',
)
console.log('done')
