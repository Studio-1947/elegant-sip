import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import { buildSrcSet } from '../lib/responsiveImages'

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
 * `wrapperClassName`  the wrapper is `relative` for its shimmer overlay and
 * Tailwind's stylesheet order (not class order) would decide the conflict.
 * To fill a positioned area, wrap this in a positioned div and pass
 * `wrapperClassName="w-full h-full"`.
 */
export default function SkeletonImage({
  wrapperClassName = '',
  className = '',
  onLoad,
  onError,
  srcSet,
  sizes,
  ...img
}: SkeletonImageProps) {
  // Derive the srcset from the generated variants unless the caller supplied
  // one. Without this, every consumer has to remember to pass it and phones
  // end up downloading 2560px files.
  const resolvedSrcSet = srcSet ?? buildSrcSet(typeof img.src === 'string' ? img.src : undefined, Number(img.width) || undefined)
  const resolvedSizes = sizes ?? (resolvedSrcSet ? '100vw' : undefined)

  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // Cached images can be complete before onLoad has a chance to fire; also
  // re-arm the shimmer when the src changes (same component instance).
  useEffect(() => {
    setLoaded(ref.current?.complete ?? false)
    setFailed(false)
  }, [img.src])

  return (
    <span className={`block relative overflow-hidden ${wrapperClassName}`}>
      {/* Without the `failed` guard a broken file left the shimmer animating
          forever over an invisible <img>, with no way to tell it never loaded. */}
      {!loaded && !failed && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      {failed && (
        <span aria-hidden="true" className="absolute inset-0 bg-[#e9ede7] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#1b261b]/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 6.75h.008v.008H18V6.75zM2.25 19.5V4.5a2.25 2.25 0 012.25-2.25h15A2.25 2.25 0 0121.75 4.5v15a2.25 2.25 0 01-2.25 2.25h-15A2.25 2.25 0 012.25 19.5z" />
          </svg>
        </span>
      )}
      <img
        ref={ref}
        {...img}
        srcSet={resolvedSrcSet}
        sizes={resolvedSizes}
        className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
        onError={(e) => {
          setFailed(true)
          onError?.(e)
        }}
      />
    </span>
  )
}
