import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Prepends and appends a full-screen "visit our website" card to the promo
 * videos, with a spoken call-to-action. Both cuts are updated.
 */

const FF = path.resolve('node_modules/ffmpeg-static/ffmpeg.exe')
const WORK = path.resolve('promo/url-work')
const AUDIO = path.resolve('promo/audio')
const BACKUP = path.resolve('promo/backup-pre-url')
mkdirSync(WORK, { recursive: true })
mkdirSync(AUDIO, { recursive: true })
mkdirSync(BACKUP, { recursive: true })

const URL_TEXT = 'https://sawabagroomingstudio.com.ng/'
const FONT_HEAD = "C\\:/Windows/Fonts/georgia.ttf"
const FONT_BODY = "C\\:/Windows/Fonts/segoeui.ttf"
const FONT_SEMI = "C\\:/Windows/Fonts/seguisb.ttf"

const TARGETS = [
  {
    name: '9x16',
    src: path.resolve('promo/sawaba-promo-9x16.mp4'),
    W: 1080,
    H: 1920,
    brandY: 500, headY: 700, lineY: 770, urlY: 800, tagY: 910,
    brandSize: 30, headSize: 48, urlSize: 46, tagSize: 28,
    lineW: 620,
  },
  {
    name: '16x9',
    src: path.resolve('promo/sawaba-promo-16x9.mp4'),
    W: 1920,
    H: 1080,
    brandY: 270, headY: 410, lineY: 480, urlY: 510, tagY: 620,
    brandSize: 36, headSize: 64, urlSize: 60, tagSize: 32,
    lineW: 900,
  },
]

function ff(args) {
  return execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function duration(file) {
  try {
    execFileSync(FF, ['-hide_banner', '-i', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return 0
  } catch (error) {
    const match = `${error.stderr ?? ''}`.match(/Duration:\s(\d+):(\d+):(\d+\.\d+)/)
    if (!match) throw new Error(`duration unavailable: ${file}`)
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  }
}

function tts(text, name) {
  const textFile = path.join(AUDIO, `${name}.txt`)
  const wav = path.join(AUDIO, `${name}.wav`)
  writeFileSync(textFile, text, 'utf8')
  if (!existsSync(wav)) {
    execFileSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(AUDIO, 'tts.ps1'), '-TextFile', textFile, '-OutFile', wav],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  }
  return wav
}

function writeText(dir, name, text) {
  const file = path.join(dir, name)
  writeFileSync(file, text, 'utf8')
  return path.relative(process.cwd(), file).replace(/\\/g, '/')
}

function card(target, headline, out, dir) {
  const brand = writeText(dir, 'brand.txt', 'SAWABA GROOMING STUDIO')
  const head = writeText(dir, 'headline.txt', headline)
  const url = writeText(dir, 'url.txt', URL_TEXT)
  const tag = writeText(dir, 'tag.txt', 'Book barbering  •  Shop the marketplace')
  const filters = [
    `drawtext=fontfile='${FONT_HEAD}':textfile='${brand}':fontcolor=0xd4af37:fontsize=${target.brandSize}:x=(w-text_w)/2:y=${target.brandY}`,
    `drawtext=fontfile='${FONT_BODY}':textfile='${head}':fontcolor=0xf5f5f5:fontsize=${target.headSize}:x=(w-text_w)/2:y=${target.headY}`,
    `drawbox=x=(iw-${target.lineW})/2:y=${target.lineY}:w=${target.lineW}:h=3:color=0xd4af37@0.9:t=fill`,
    `drawtext=fontfile='${FONT_SEMI}':textfile='${url}':fontcolor=0xd4af37:fontsize=${target.urlSize}:x=(w-text_w)/2:y=${target.urlY}`,
    `drawtext=fontfile='${FONT_BODY}':textfile='${tag}':fontcolor=0x9ca3af:fontsize=${target.tagSize}:x=(w-text_w)/2:y=${target.tagY}`,
  ]
  ff(['-y', '-f', 'lavfi', '-i', `color=c=0x0a0a0c:s=${target.W}x${target.H}:d=1`, '-vf', filters.join(','), '-frames:v', '1', out])
}

function cardClip(target, image, narration, out) {
  const seconds = Math.max(4.2, duration(narration) + 0.8)
  ff([
    '-y', '-loop', '1', '-t', String(seconds), '-i', image,
    '-i', narration,
    '-filter_complex', `[1:a]apad=pad_dur=${seconds},atrim=0:${seconds},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[a]`,
    '-map', '0:v', '-map', '[a]',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-t', String(seconds),
    out,
  ])
  return seconds
}

function buildTarget(target, index) {
  const dir = path.join(WORK, target.name)
  mkdirSync(dir, { recursive: true })

  const startPng = path.join(dir, 'start.png')
  const endPng = path.join(dir, 'end.png')
  card(target, 'Visit our official website', startPng, dir)
  card(target, 'Visit us today', endPng, dir)

  const startWav = tts(
    'Visit our official website, sawaba grooming studio dot com dot n g, to book your next grooming appointment or shop the marketplace.',
    `${target.name}-start`,
  )
  const endWav = tts(
    'Visit sawaba grooming studio dot com dot n g today. Your grooming, your shopping, all in one place.',
    `${target.name}-end`,
  )

  const startClip = path.join(dir, 'start.mp4')
  const endClip = path.join(dir, 'end.mp4')
  const bodyClip = path.join(dir, 'body.mp4')
  const startSeconds = cardClip(target, startPng, startWav, startClip)
  const endSeconds = cardClip(target, endPng, endWav, endClip)
  copyFileSync(target.src, bodyClip)

  const list = path.join(dir, 'concat.txt')
  writeFileSync(list, ['start.mp4', 'body.mp4', 'end.mp4'].map((f) => `file '${f}'`).join('\n'), 'utf8')
  const joined = path.join(dir, 'joined.mp4')
  try {
    ff(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', joined])
  } catch {
    // Fall back to a full re-encode if the copied segments are not compatible.
    ff(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', joined])
  }

  copyFileSync(target.src, path.join(BACKUP, path.basename(target.src)))
  renameSync(joined, target.src)

  const total = duration(target.src)
  console.log(`${target.name}: ${total.toFixed(1)}s (cards ${startSeconds.toFixed(1)}s + ${endSeconds.toFixed(1)}s)`)
  void index
}

for (let index = 0; index < TARGETS.length; index += 1) buildTarget(TARGETS[index], index)
console.log('url cards applied')
