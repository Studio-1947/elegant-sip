import { Link, useDocumentMeta } from '../lib/router'

export default function NotFoundPage() {
  useDocumentMeta('Page Not Found — Elegant Sip', 'The page you were looking for could not be found.')

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 flex items-start justify-center">
      <div className="max-w-lg mx-auto text-center">
        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-5">404</span>
        <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05] mb-6">
          This leaf has <span className="text-[#8bb56e]">drifted away</span>
        </h1>
        <p className="text-sm text-[#4a584a] leading-relaxed mb-10">
          The page you're looking for doesn't exist — perhaps it was steeped too long, or the
          address has a typo. Let's get you back to something warm.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors text-center"
          >
            Back to Home
          </Link>
          <Link
            to="/shop"
            className="border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-white text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-all text-center"
          >
            Browse the Collection
          </Link>
        </div>
      </div>
    </div>
  )
}
