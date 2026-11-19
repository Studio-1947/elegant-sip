/** A review's stars: filled up to the rating (drawn to the nearest whole star), outlined after. Read out with the exact rating. */
export default function StarRating({ rating, className = 'flex gap-1 text-[#4a7333] text-sm mb-4' }: { rating: number; className?: string }) {
  return (
    <div role="img" className={className} aria-label={`Rated ${rating} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill={i < Math.round(rating) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </div>
  )
}
