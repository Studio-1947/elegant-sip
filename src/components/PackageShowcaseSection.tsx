import { Link } from '../lib/router'

export default function PackageShowcaseSection() {
  return (
    <div className="w-full overflow-hidden bg-[#f9faf7] pb-24">
      <div className="max-w-[1360px] mx-auto px-0 md:px-12 lg:px-16">
        <div className="relative md:rounded-2xl overflow-hidden md:border md:border-[#1b261b]/10 md:shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          <img
            src="/package.webp"
            alt="Elegant Tea Packaging Showcase"
            loading="lazy"
            width={2560}
            height={1338}
            className="w-full h-auto block object-cover"
          />

          {/* Phone: gifting overlay */}
          <div className="md:hidden absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          <div className="md:hidden absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <span className="text-[#8bb56e] text-[10px] font-mono font-bold tracking-[0.25em] uppercase block mb-1.5">
                The Gifting Edit
              </span>
              <p className="text-white text-lg font-bold leading-snug">Finest Darjeeling, boxed.</p>
            </div>
            <Link
              to="/shop"
              className="bg-white text-[#1b261b] text-[10px] font-mono font-bold tracking-widest uppercase py-2.5 px-5 rounded-full flex-shrink-0"
            >
              Explore
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
