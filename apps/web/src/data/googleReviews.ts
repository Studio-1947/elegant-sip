/* ────────────────────────────────────────────────────────────────────────────
 * Google reviews of Elegant Sip, copied by hand from the Google listing.
 *
 * Only real reviews, word for word as their authors wrote them, under the
 * names they gave on Google. Never invent, edit or merge one. The homepage
 * section (components/GoogleReviewsSection.tsx) shows nothing while the list
 * is empty. Update `rating` and `total` from the listing when adding reviews.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GoogleReview {
  id: string
  author: string
  /** 1 to 5, as given on Google. */
  rating: number
  /** As Google showed it when copied, like "5 months ago", or a date. */
  when: string
  text: string
  /** Paths under /public, like "/reviews/saptarshi-1.webp". */
  photos?: string[]
  /** The reviewer's profile picture, under /public. */
  avatar?: string
  ownerReply?: string
}

export const googleListing = {
  /** The listing's overall rating and review count on Google, when last copied. */
  rating: 5.0,
  total: 22,
  /** Opens the listing on Google Maps. */
  url: 'https://www.google.com/maps/search/?api=1&query=Elegant%20Sip%20Okayti%20Tea%20Estate%20Mirik',
}

/**
 * In Google's "Most relevant" order, copied on 19 Nov 2026. Left out until
 * its full text is copied: M. Morales (cut off at "More"; written in Spanish,
 * shown by Google in translation). Four star-only reviews have no text to show.
 */
export const googleReviews: GoogleReview[] = [
  {
    id: 'saptarshi-roy-choudhuri',
    author: 'Saptarshi Roy Choudhuri',
    rating: 5,
    when: 'Edited 5 months ago',
    text: 'I ordered the Golden Needles from Elegant Sip via their Instagram page. This rare tea captures the best of both worlds! The fresh, sweet smell and tasting notes of the needles with the familiar brisk, malty finish of black tea. What a treat to start the day with!! The quality of the Tea leaves is absolutely first class, full of unbroken tips that would make any tea lover jump in excitement (I sure did!).\nThank you!',
  },
  {
    id: 'sonam-sherpa',
    author: 'Sonam Sherpa',
    rating: 5,
    when: '6 months ago',
    text: "From the moment you step into the serene atmosphere of the estate, you’re greeted with a sense of calm that only fresh mountain air and rolling green hills can provide. If you’re looking for an elegant escape where you can truly 'sip in style,' ELEGANT SIP, OKAITY is the ultimate destination for any tea connoisseur.",
  },
  {
    id: 'soumi-dutta',
    author: 'Soumi Dutta',
    rating: 5,
    when: '5 months ago',
    text: 'I recently tried their tea, and it has genuinely added a little warmth and freshness to my mornings. The aroma itself feels so comforting and refreshing, and the taste is just as amazing. My entire family loved it too. Will definitely be buying from them again. ☕✨',
    ownerReply: 'Thank you so much Soumi, glad you liked our tea and thank you again for choosing us. Happy Sipping 🫖',
  },
  {
    id: 'xan-lyksmusic',
    author: 'Xan lyksmusic',
    rating: 5,
    when: '8 months ago',
    text: "Ordered tea via their Instagram page and I am blown away by the freshness of their tea. The infusion emits a strong aroma, testament to the tea's freshness and its meticulous processing. Furthermore, the infusion shows beautiful whole leaves with very little to no broken leaves showcasing attention to quality!",
  },
  {
    id: 's-thapa',
    author: 'S Thapa',
    rating: 5,
    when: '9 months ago',
    text: 'I tried the first flush tea from Elegant Sip during my visit to the Queen of Hills and it was pure bliss—like spring captured in a cup! The delicate floral notes with a crisp, grape-like brightness and zero heaviness was perfect to start the day or for a light afternoon pick-me-up. Brewed it as guided and every sip was refreshing and nuanced. If you love subtle premium teas, this is a must-try!\nTheir premium white tea (Silver Needle) is also highly recommended and makes for a perfect gift for your discerning friends and family.',
    ownerReply: "Thank you Mr. Thapa. We're extremely glad you liked our collection and described it in a most poetic way possible.\nHope to see you really soon. Happy Sipping 🍵",
  },
  {
    id: 'jimi-roy-sarkar',
    author: 'Jimi Roy Sarkar',
    rating: 5,
    when: '9 months ago',
    text: 'Very good quality Darjeeling tea variants...\nReally liked the aroma of the product...',
  },
  {
    id: 'gloriya-rai',
    author: 'Gloriya Rai',
    rating: 5,
    when: '9 months ago',
    text: 'Elegant Sip tea offers a light, refined cup with classic floral and muscatel notes. Perfect for those who enjoy authentic Darjeeling tea without milk...and the gift pack was good with budget friendly.... And the taste was awesome',
    ownerReply: 'We appreciate your time for the review, and glad you liked our gift pack and the tea. Happy Sipping 🫖',
  },
  {
    id: 'vaani-vandhana-allay',
    author: 'Vaani Vandhana Allay',
    rating: 5,
    when: '9 months ago',
    text: '‘Elegant Sip’ keeps me feeling fresh and rejuvenated, whether it’s early morning, afternoon, or evening. Maybe it’s the super organic ingredients, but I’m loving it! The price is reasonable too. I look forward to sipping this tea and enjoying the freshness and aroma of a true Himalayan experience 😊',
  },
  {
    id: 'samiksha-rai',
    author: 'samiksha rai',
    rating: 5,
    when: '9 months ago',
    text: 'Highly recommended for its high quality. I along with my family have been drinking it since the last three months, the packaging is so nice that we prefer for the gifting purpose as well… well packaged and super quality…👍',
    ownerReply: 'Thank you for such a warm reply. Glad you liked our gift collection, we take pride in our packaging. Happy Sipping 🍵.',
  },
  {
    id: 'narbu-lepcha',
    author: 'Narbu Lepcha',
    rating: 5,
    when: '9 months ago',
    text: 'The tea taste great.... You find premium tea at minimum cost... Suggest to try atleast once....',
  },
  {
    id: 'pratik-lama',
    author: 'PRATIK LAMA',
    rating: 5,
    when: '9 months ago',
    text: 'I personally feel that the tea leaves genuinely tastes very very good.',
    ownerReply: 'Thank you Pratik for your lovely feedback. Hope you see you back again 🫖',
  },
  {
    id: 'satyen-bardewa',
    author: 'Satyen Bardewa',
    rating: 5,
    when: '9 months ago',
    text: 'Enjoy the freshness of Garden Tea from Darjeeling Hills with Elegant Sip, a journey from freshness to relaxation with budget friendly👍',
  },
  {
    id: 'prabir-kumar-das',
    author: 'Prabir kumar Das',
    rating: 5,
    when: '9 months ago',
    text: 'White tea is the best...thank you Elegant sip for this lovely morning',
    ownerReply: 'Glad you liked our white tea collection. Hope to see you really soon, till then happy Sipping 🍵',
  },
  {
    id: 'bandwita-allay',
    author: 'Bandwita Allay',
    rating: 5,
    when: '10 months ago',
    text: 'Silver tea , first flush, 2nd flush, green tea and broken tea ...must try',
  },
  {
    id: 'kavita-tewari',
    author: 'Kavita Tewari',
    rating: 5,
    when: '8 months ago',
    text: 'Tea leaves are genuinely refreshing..',
    ownerReply: 'Thank you so much. Happy Sipping🫖',
  },
  {
    id: 'mousumi-roy',
    author: 'Mousumi Roy',
    rating: 5,
    when: '9 months ago',
    text: 'Very tasty tea',
    ownerReply: 'Glad you liked our collection. Hope to see you again soon. Happy Sipping 🫖',
  },
  {
    id: 'subhendu-kundu',
    author: 'Subhendu Kundu',
    rating: 5,
    when: '9 months ago',
    text: 'Elegant taste at best price',
  },
]
