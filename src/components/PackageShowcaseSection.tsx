export default function PackageShowcaseSection() {
  return (
    <div className="w-full overflow-hidden bg-[#f9faf7] pb-24">
      <div className="max-w-[1360px] mx-auto px-6 md:px-12 lg:px-16">
        <img
          src="/package.webp"
          alt="Elegant Tea Packaging Showcase"
          loading="lazy"
          width={2560}
          height={1338}
          className="w-full h-auto block object-cover rounded-2xl border border-[#1b261b]/10 shadow-[0_12px_40px_rgba(27,38,27,0.04)]"
        />
      </div>
    </div>
  )
}
