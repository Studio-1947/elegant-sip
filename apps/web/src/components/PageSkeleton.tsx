/**
 * Full-page skeleton shown while a route's code chunk loads (Suspense
 * fallback): banner scaffold + a row of product-card ghosts.
 */
export default function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#f9faf7] pt-32 pb-24 px-6 md:px-12 lg:px-24" aria-busy="true" aria-label="Loading page">
      <div className="max-w-6xl mx-auto">
        {/* Banner scaffold */}
        <div className="skeleton h-3 w-28 rounded-full mb-6" />
        <div className="skeleton h-10 md:h-14 w-3/4 max-w-xl rounded-xl mb-5" />
        <div className="skeleton h-4 w-full max-w-2xl rounded-full mb-2.5" />
        <div className="skeleton h-4 w-2/3 max-w-xl rounded-full mb-14" />

        {/* Card ghosts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`bg-white border border-[#1b261b]/10 rounded-2xl overflow-hidden ${i === 1 ? 'hidden md:block' : ''} ${i === 2 ? 'hidden lg:block' : ''}`}>
              <div className="skeleton aspect-[4/5] w-full" />
              <div className="p-6 space-y-3">
                <div className="skeleton h-5 w-2/3 rounded-full" />
                <div className="skeleton h-4 w-full rounded-full" />
                <div className="skeleton h-4 w-5/6 rounded-full" />
                <div className="skeleton h-11 w-full rounded-lg mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
