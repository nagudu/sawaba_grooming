import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Builds the Sawaba promotional video from real captured screenshots:
 * narration (Windows TTS) + Ken Burns motion + cross-chapter sequencing,
 * a synthesized music bed, and burned-in subtitles.
 */

const ROOT = process.cwd()
const FF = path.resolve('node_modules/ffmpeg-static/ffmpeg.exe')
const SHOTS = path.resolve('promo/shots')
const AUDIO = path.resolve('promo/audio')
const WORK = path.resolve('promo/work')
mkdirSync(AUDIO, { recursive: true })
mkdirSync(WORK, { recursive: true })

const W = 1920
const H = 1080
const FPS = 30

const CHAPTERS = [
  {
    id: '01-intro',
    title: 'Sawaba Grooming Studio',
    narration:
      'Welcome to Sawaba Grooming Studio — a premium barbershop and a modern online marketplace, all in one place.',
    images: ['01-home.png', '05-shop.png'],
    card: 'intro',
  },
  {
    id: '02-customer',
    title: 'Customer experience',
    narration:
      'For customers, creating an account is quick. Browse grooming services, choose your preferred barber, pick a time, and book in seconds. Pay securely online and review every booking detail from your dashboard.',
    images: ['02-services.png', '03-barbers.png', '04-booking.png', '11-customer-dashboard.png', '37-customer-payments.png'],
  },
  {
    id: '03-admin',
    title: 'Admin dashboard',
    narration:
      'The admin dashboard gives the studio full control: customers, barbers, services, appointments, payments, reviews, and marketplace operations, all from one clean workspace.',
    images: ['15-admin-dashboard.png', '16-admin-appointments.png', '35-admin-shop-payments.png', '20-admin-marketplace.png'],
  },
  {
    id: '04-barber',
    title: 'Barber dashboard',
    narration:
      'Barbers get their own portal to manage appointments, view customer bookings, and track their daily activity and earnings.',
    images: ['24-barber-dashboard.png', '25-barber-appointments.png'],
  },
  {
    id: '05-vendor',
    title: 'Vendor marketplace',
    narration:
      'Vendors register, add products with images and videos, manage orders, and follow their wallet, earnings and withdrawals — all in one dashboard.',
    images: ['26-vendor-dashboard.png', '27-vendor-products.png', '28-vendor-orders.png', '29-vendor-wallet.png'],
  },
  {
    id: '06-shopping',
    title: 'Online shopping',
    narration:
      'Shoppers can browse the marketplace, explore product details and videos, add items to the cart, and check out with home delivery or shop pickup.',
    images: ['05-shop.png', '06-product.png', '08-cart.png', '09-checkout.png'],
  },
  {
    id: '07-orders',
    title: 'Order management',
    narration:
      'Every order gets a unique order number and a secure tracking link. Delivery orders can be followed step by step, while pickup orders receive a unique pickup code that staff verify before collection.',
    images: ['13-order-detail.png', '10-track.png', '22-admin-pickup.png'],
  },
  {
    id: '08-mobile',
    title: 'On every device',
    narration:
      'The full experience is responsive, so customers, vendors, barbers and admins can work comfortably from any phone.',
    images: ['31-mobile-shop.png', '32-mobile-product.png', '33-mobile-orders.png'],
  },
  {
    id: '09-outro',
    title: 'Your Grooming, Your Shopping, All in One Place',
    narration:
      'Sawaba Grooming Studio. Your grooming, your shopping, all in one place.',
    images: [],
    card: 'outro',
  },
]

function ff(args) {
  return execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function mediaDuration(file) {
  try {
    const output = execFileSync(FF, ['-hide_banner', '-i', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return 0
  } catch (error) {
    const text = `${error.stderr ?? ''}`
    const match = text.match(/Duration:\s(\d+):(\d+):(\d+\.\d+)/)
    if (!match) throw new Error(`Could not read duration of ${file}`)
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  }
}

function makeCard(kind, out) {
  const fontHead = 'C\\:/Windows/Fonts/georgia.ttf'
  const fontBody = 'C\\:/Windows/Fonts/segoeui.ttf'
  const fontSmall = 'C\\:/Windows/Fonts/seguisb.ttf'
  const tagline = kind === 'outro'
  const filters = [
    `drawbox=x=760:y=470:w=400:h=2:color=0xd4af37@0.9:t=fill`,
    `drawtext=fontfile='${fontHead}':text='SAWABA':fontcolor=0xd4af37:fontsize=132:x=(w-text_w)/2:y=300`,
    `drawtext=fontfile='${fontBody}':text='Grooming Studio':fontcolor=0xf5f5f5:fontsize=58:x=(w-text_w)/2:y=500`,
    `drawtext=fontfile='${fontSmall}':text='${tagline ? 'Premium Barbershop  •  Marketplace' : 'Premium Barbershop  •  Marketplace'}':fontcolor=0x9ca3af:fontsize=28:x=(w-text_w)/2:y=600`,
  ]
  if (tagline) {
    filters.push(
      `drawtext=fontfile='${fontBody}':text='Your Grooming, Your Shopping,':fontcolor=0xf5f5f5:fontsize=46:x=(w-text_w)/2:y=740`,
      `drawtext=fontfile='${fontBody}':text='All in One Place.':fontcolor=0xd4af37:fontsize=46:x=(w-text_w)/2:y=810`,
    )
  }
  ff([
    '-f', 'lavfi', '-i', `color=c=0x0a0a0c:s=${W}x${H}:d=1`,
    '-vf', filters.join(','),
    '-frames:v', '1',
    out,
  ])
}

function makeSceneVideo(imagePath, seconds, out) {
  const frames = Math.max(2, Math.round(seconds * FPS))
  ff([
    '-loop', '1', '-t', String(seconds), '-i', imagePath,
    '-vf',
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0c,` +
      `zoompan=z='min(zoom+0.0004,1.03)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},` +
      `format=yuv420p`,
    '-r', String(FPS), '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    out,
  ])
}

function synthNarration(chapter) {
  const textFile = path.join(AUDIO, `${chapter.id}.txt`)
  const wavFile = path.join(AUDIO, `${chapter.id}.wav`)
  writeFileSync(textFile, chapter.narration, 'utf8')
  if (existsSync(wavFile)) return wavFile
  execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(AUDIO, 'tts.ps1'), '-TextFile', textFile, '-OutFile', wavFile],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return wavFile
}

function buildChapter(chapter) {
  const narration = synthNarration(chapter)
  const narrationSeconds = mediaDuration(narration)
  const total = Math.max(5, narrationSeconds + 0.9)
  const images = chapter.images.length > 0
    ? chapter.images.map((name) => path.join(SHOTS, name))
    : [path.join(WORK, `${chapter.id}-card.png`)]

  if (chapter.card) makeCard(chapter.card, images[0])

  const per = total / images.length
  const parts = images.map((image, index) => {
    const seconds = index === images.length - 1 ? total - per * (images.length - 1) : per
    const out = path.join(WORK, `${chapter.id}-part${index}.mp4`)
    makeSceneVideo(image, seconds, out)
    return out
  })

  const listFile = path.join(WORK, `${chapter.id}-parts.txt`)
  writeFileSync(listFile, parts.map((part) => `file '${path.basename(part)}'`).join('\n'), 'utf8')
  const silent = path.join(WORK, `${chapter.id}-silent.mp4`)
  ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent])

  const final = path.join(WORK, `${chapter.id}.mp4`)
  ff([
    '-i', silent,
    '-i', narration,
    '-filter_complex', `[1:a]apad=pad_dur=${total},atrim=0:${total},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[a]`,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-t', String(total),
    final,
  ])
  return { file: final, total, narrationSeconds }
}

function makeMusic(totalSeconds) {
  const out = path.join(AUDIO, 'music.wav')
  ff([
    '-f', 'lavfi',
    '-i',
    `aevalsrc=0.05*sin(2*PI*196*t)+0.04*sin(2*PI*246.94*t)+0.035*sin(2*PI*293.66*t)+0.02*sin(2*PI*98*t):s=44100:d=${Math.ceil(totalSeconds)}`,
    '-af', 'tremolo=f=0.12:d=0.35,lowpass=f=1400,volume=0.35',
    out,
  ])
  return out
}

function makeSubtitles(chapters, starts) {
  const lines = []
  let index = 1
  chapters.forEach((chapter, i) => {
    const start = starts[i]
    const end = start + chapter.total - 0.25
    const fmt = (seconds) => {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = (seconds % 60).toFixed(3).padStart(6, '0')
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.replace('.', ',')}`
    }
    lines.push(String(index++))
    lines.push(`${fmt(start)} --> ${fmt(end)}`)
    lines.push(chapter.title)
    lines.push('')
  })
  const file = path.resolve('promo/subs.srt')
  writeFileSync(file, lines.join('\n'), 'utf8')
  // Relative path avoids the Windows drive colon inside the ffmpeg filter.
  return 'promo/subs.srt'
}

function main() {
  const built = []
  let elapsed = 0
  for (const chapter of CHAPTERS) {
    console.log(`building ${chapter.id}…`)
    const result = buildChapter(chapter)
    built.push({ chapter, ...result, start: elapsed })
    elapsed += result.total
    console.log(`  ${chapter.id}: ${result.total.toFixed(2)}s (narration ${result.narrationSeconds.toFixed(2)}s)`)
  }

  const listFile = path.join(WORK, 'chapters.txt')
  writeFileSync(listFile, built.map((entry) => `file '${path.basename(entry.file)}'`).join('\n'), 'utf8')

  const joined = path.join(WORK, 'joined.mp4')
  ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', joined])
  const joinedDuration = built.reduce((sum, entry) => sum + entry.total, 0)

  const music = makeMusic(joinedDuration)
  const subs = makeSubtitles(built.map((entry) => ({ ...entry.chapter, total: entry.total })), built.map((entry) => entry.start))

  const final = path.resolve('promo/sawaba-promo-16x9.mp4')
  ff([
    '-i', joined,
    '-stream_loop', '-1', '-i', music,
    '-filter_complex',
    `[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.16[a];` +
      `[0:v]subtitles=${subs.replace(/\\/g, '/')}:force_style='FontName=Segoe UI,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=44,Alignment=2'[v]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart',
    '-shortest',
    final,
  ])
  console.log('final:', final, `${(readFileSync(final).length / 1024 / 1024).toFixed(1)} MB`, `${joinedDuration.toFixed(1)}s`)
}

main()
