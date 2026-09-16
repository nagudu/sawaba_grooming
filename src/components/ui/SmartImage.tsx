import { useState } from 'react'

const FALLBACK_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="#14141a"/><text x="50%" y="50%" fill="#c9a24b" font-family="Georgia,serif" font-size="42" font-weight="600" text-anchor="middle" dominant-baseline="central" opacity="0.7">SAWABA</text></svg>')}`

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string
}

export default function SmartImage({
  src,
  alt = '',
  fallbackSrc,
  className = '',
  ...rest
}: SmartImageProps) {
  const [imgSrc, setImgSrc] = useState(src)
  const handleError = () => {
    if (imgSrc !== (fallbackSrc ?? FALLBACK_SVG)) {
      setImgSrc(fallbackSrc ?? FALLBACK_SVG)
    }
  }
  return (
    <img
      src={imgSrc}
      alt={alt}
      className={`object-cover ${className}`}
      onError={handleError}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  )
}