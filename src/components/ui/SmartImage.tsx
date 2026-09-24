import { useState } from 'react'

const FALLBACK_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="#14141a"/><text x="50%" y="50%" fill="#c9a24b" font-family="Georgia,serif" font-size="42" font-weight="600" text-anchor="middle" dominant-baseline="central" opacity="0.7">SAWABA</text></svg>')}`

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string
  /**
   * How the image fits its box:
   *  - `cover` (default): fills the box, may crop edges (avatars, hero art)
   *  - `contain`: shows the ENTIRE image, letterboxed — used for gallery
   *    content where cropping would hide important detail (e.g. SAWABA
   *    branding on an apron)
   */
  fit?: 'cover' | 'contain'
}

export default function SmartImage({
  src,
  alt = '',
  fallbackSrc,
  className = '',
  fit = 'cover',
  ...rest
}: SmartImageProps) {
  // Initialize with the fallback when src is missing/empty: a srcless <img>
  // never fires `onError`, so waiting for the error handler would strand the
  // caller with a broken image frame (e.g. barbers without a photo).
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc || FALLBACK_SVG)
  const handleError = () => {
    if (imgSrc !== (fallbackSrc ?? FALLBACK_SVG)) {
      setImgSrc(fallbackSrc ?? FALLBACK_SVG)
    }
  }
  const objectFit = fit === 'contain' ? 'object-contain' : 'object-cover'
  return (
    <img
      src={imgSrc}
      alt={alt}
      className={`${objectFit} ${className}`}
      onError={handleError}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  )
}
