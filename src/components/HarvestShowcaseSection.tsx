import SkeletonImage from './SkeletonImage'

export default function HarvestShowcaseSection() {
  return (
    <div className="w-full overflow-hidden md:pb-20">
      <SkeletonImage
        src="/harvest.webp"
        alt="Tea plantation at harvest"
        loading="lazy"
        width={2560}
        height={1178}
        className="w-full h-auto block object-cover"
      />
    </div>
  )
}
