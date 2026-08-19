import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

interface SkeletonImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Classes for the wrapper hosting the shimmer — use for sizing/positioning. */
  wrapperClassName?: string
}

/**
 * An <img> that shows a brand-tinted shimmer until the file has painted.
 * The wrapper needs a defined box: either pass width/height on the image
 * (the browser reserves the aspect ratio) or size the wrapper via
 * `wrapperClassName` / an aspect-ratio parent.
 *
 * NOTE: never pass position utilities (`absolute`, `fixed`) in
 * `wrapperClassName` — the wrapper is `relative` for its shimmer overlay and
 * Tailwind's stylesheet order (not class order) would decide the conflict.
 * To fill a positioned area, wrap this in a positioned div and pass
 * `wrapperClassName="w-full h-full"`.
 */
export default function SkeletonImage({ wrapperClassName = '', className = '', onLoad, ...img }: SkeletonImageProps) {
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // Cached images can be complete before onLoad has a chance to fire; also
  // re-arm the shimmer when the src changes (same component instance).
  useEffect(() => {
    setLoaded(ref.current?.complete ?? false)
  }, [img.src])

  return (
    <span className={`block relative overflow-hidden ${wrapperClassName}`}>
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <img
        ref={ref}
        {...img}
        className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
      />
    </span>
  )
}
