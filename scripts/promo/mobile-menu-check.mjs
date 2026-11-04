import { execSync } from 'node:child_process'

const APP = 'http://localhost:5173'
const SESSION = 'menu-check'

function ab(cmd) {
  try {
    return execSync(`agent-browser --session ${SESSION} ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
}

function val(expr) {
  return ab(`eval "${expr}"`).trim().split('\n').pop().replace(/^"|"$/g, '')
}

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [430, 932],
  [768, 1024],
]

for (const [w, h] of VIEWPORTS) {
  ab('close')
  ab(`set viewport ${w} ${h} 2`)
  ab(`open "${APP}"`)
  ab('wait 1500')
  ab(`eval "document.querySelector('button[aria-controls=mobile-menu]').click()"`)
  ab('wait 700')

  const expanded = val("document.querySelector('button[aria-controls=mobile-menu]').getAttribute('aria-expanded')")
  const label = val("document.querySelector('button[aria-controls=mobile-menu]').getAttribute('aria-label')")
  const panel = val("document.querySelector('#mobile-menu') ? 'open' : 'closed'")
  const overflow = val("document.documentElement.scrollWidth + '/' + window.innerWidth")
  const bodyOverflow = val('document.body.style.overflow')
  const scroll = val("document.querySelector('#mobile-menu-scroll').scrollHeight + '/' + document.querySelector('#mobile-menu-scroll').clientHeight")
  const text = val("document.querySelector('#mobile-menu').innerText.replace(/\\s+/g, ' ').slice(0, 150)")

  ab(`screenshot promo/shots/menu-${w}x${h}.png`)
  console.log(`${w}x${h}  expanded=${expanded}  label="${label}"  panel=${panel}  docScroll/Viewport=${overflow}  bodyOverflow=${bodyOverflow}  scroll=${scroll}`)
  console.log(`  ${text}`)

  ab(`eval "document.querySelector('button[aria-controls=mobile-menu]').click()"`)
  ab('wait 350')
}

// Desktop must be untouched.
ab('close')
ab('set viewport 1440 900 1')
ab(`open "${APP}"`)
ab('wait 1500')
const desktopNav = val("getComputedStyle(document.querySelector('header nav')).display")
const mobileBtn = val("getComputedStyle(document.querySelector('button[aria-controls=mobile-menu]')).display")
const desktopOverflow = val("document.documentElement.scrollWidth + '/' + window.innerWidth")
console.log(`desktop 1440x900  nav=${desktopNav}  mobileButton=${mobileBtn}  docScroll/Viewport=${desktopOverflow}`)
ab('close')
