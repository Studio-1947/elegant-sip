import { Link } from '../lib/router'
import { useGardens } from '../lib/useGardens'

/** "From <garden> · <region>" under a product's name, only when staff have linked it to a garden. */
export default function ProductGardenLine({ productSlug }: { productSlug: string }) {
  const garden = useGardens().find((g) => g.productSlugs.includes(productSlug))
  if (!garden) return null
  return (
    <Link
      to="/gardens"
      className="inline-block mb-4 text-xs font-mono tracking-wide text-[#4a584a] hover:text-[#4a7333] underline decoration-[#8bb56e]/50 underline-offset-2 transition-colors"
    >
      From {garden.name} · {garden.region}
    </Link>
  )
}
