/**
 * Responsive sweep helper — evaluates in-page via preview_evaluate.
 * Detects horizontal overflow and its widest offender per page.
 * (kept as a reference; the checks run through preview_evaluate directly)
 */
export const OVERFLOW_SNIPPET = `
(() => {
  const doc = document.documentElement
  const overflowPx = doc.scrollWidth - doc.clientWidth
  if (overflowPx <= 0) return JSON.stringify({ overflow: 0 })
  const vw = doc.clientWidth
  let widest = null
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) {
      if (!widest || r.width > widest.width) {
        widest = { tag: el.tagName, cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 90), width: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) }
      }
    }
  }
  return JSON.stringify({ overflow: overflowPx, widest })
})()
`
