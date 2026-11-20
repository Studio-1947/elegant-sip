/* ────────────────────────────────────────────────────────────────────────────
 * Google reviews of Elegant Sip, exported from the Google listing on
 * 2026-11-19 (all 22: 18 with words, the rest stars only).
 *
 * Only real reviews, word for word as their authors wrote them, under the
 * names they gave on Google. Never invent, edit or merge one. Profile
 * pictures and photos are copies served from /public/reviews. The homepage
 * section (components/GoogleReviewsSection.tsx) shows nothing while the list
 * is empty. Update `rating` and `total` from the listing when adding reviews.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ReviewPhoto {
  /** A small square crop, for the card. */
  thumb: string
  /** The whole photo, opened on click. */
  full: string
}

export interface GoogleReview {
  id: string
  author: string
  /** 1 to 5, as given on Google. */
  rating: number
  /** As Google showed it when copied, like "5 months ago". */
  when: string
  /** Absent for a star-only rating. */
  text?: string
  /** The reviewer's profile picture, under /public. */
  avatar?: string
  photos?: ReviewPhoto[]
  ownerReply?: string
}

export const googleListing = {
  /** The listing's overall rating and review count on Google, when last copied. */
  rating: 5.0,
  total: 22,
  /** The listing's reviews on Google. */
  url: 'https://search.google.com/local/reviews?placeid=ChIJHVd7vKDN5TkReodCtFZ5Ljw',
}

/** In Google's "Most relevant" order. */
export const googleReviews: GoogleReview[] = [
  {
    id: 'saptarshi-roy-choudhuri',
    author: 'Saptarshi Roy Choudhuri',
    rating: 5,
    when: 'Edited 5 months ago',
    text: 'I ordered the Golden Needles from Elegant Sip via their Instagram page. This rare tea captures the best of both worlds! The fresh, sweet smell and tasting notes of the needles with the familiar brisk, malty finish of black tea. What a treat to start the day with!!\nThe quality of the Tea leaves is absolutely first class, full of unbroken tips that would make any tea lover jump in excitement (I sure did!).\nThank you!',
    avatar: '/reviews/saptarshi-roy-choudhuri-avatar.webp',
    photos: [
      { thumb: '/reviews/saptarshi-roy-choudhuri-1-thumb.webp', full: '/reviews/saptarshi-roy-choudhuri-1.webp' },
      { thumb: '/reviews/saptarshi-roy-choudhuri-2-thumb.webp', full: '/reviews/saptarshi-roy-choudhuri-2.webp' },
      { thumb: '/reviews/saptarshi-roy-choudhuri-3-thumb.webp', full: '/reviews/saptarshi-roy-choudhuri-3.webp' },
      { thumb: '/reviews/saptarshi-roy-choudhuri-4-thumb.webp', full: '/reviews/saptarshi-roy-choudhuri-4.webp' },
    ],
    ownerReply: 'Thank you so much for the elaborate review. Glad you liked our Golden needles so much, it is always a pleasure continuing doing business with you 🫶🏻\nHappy Sipping 🫖',
  },
  {
    id: 'sonam-sherpa',
    author: 'Sonam Sherpa',
    rating: 5,
    when: '6 months ago',
    text: "From the moment you step into the serene atmosphere of the estate, you're greeted with a sense of calm that only fresh mountain air and rolling green hills can provide. If you're looking for an elegant escape where you can truly 'sip in style,' ELEGANT SIP, OKAITY is the ultimate destination for any tea connoisseur.",
    avatar: '/reviews/sonam-sherpa-avatar.webp',
    photos: [
      { thumb: '/reviews/sonam-sherpa-1-thumb.webp', full: '/reviews/sonam-sherpa-1.webp' },
      { thumb: '/reviews/sonam-sherpa-2-thumb.webp', full: '/reviews/sonam-sherpa-2.webp' },
      { thumb: '/reviews/sonam-sherpa-3-thumb.webp', full: '/reviews/sonam-sherpa-3.webp' },
    ],
    ownerReply: 'Thank you very much for your lovely revirw. Glad you liked the vibe of our place. Happy Sipping🫖',
  },
  {
    id: 'soumi-dutta',
    author: 'Soumi Dutta',
    rating: 5,
    when: '5 months ago',
    text: 'I recently tried their tea, and it has genuinely added a little warmth and freshness to my mornings. The aroma itself feels so comforting and refreshing, and the taste is just as amazing. My entire family loved it too. Will definitely be buying from them again. ☕✨',
    avatar: '/reviews/soumi-dutta-avatar.webp',
    ownerReply: 'Thank you so much Soumi, glad you liked our tea and thank you again for choosing us. Happy Sipping 🫖',
  },
  {
    id: 'xan-lyksmusic',
    author: 'Xan lyksmusic',
    rating: 5,
    when: '8 months ago',
    text: "Ordered tea via their Instagram page and I am blown away by the freshness of their tea. The infusion emits a strong aroma, testament to the tea's freshness and its meticulous processing. Furthermore, the infusion shows beautiful whole leaves with very little to no broken leaves showcasing attention to quality!",
    avatar: '/reviews/xan-lyksmusic-avatar.webp',
    photos: [
      { thumb: '/reviews/xan-lyksmusic-1-thumb.webp', full: '/reviews/xan-lyksmusic-1.webp' },
      { thumb: '/reviews/xan-lyksmusic-2-thumb.webp', full: '/reviews/xan-lyksmusic-2.webp' },
    ],
    ownerReply: 'Thank you for ordering, glad you liked our organic white tea. We hope to see more orders from your end. Happy Sipping.',
  },
  {
    id: 's-thapa',
    author: 'S Thapa',
    rating: 5,
    when: '9 months ago',
    text: 'I tried the first flush tea from Elegant Sip during my visit to the Queen of Hills and it was pure bliss—like spring captured in a cup! The delicate floral notes with a crisp, grape-like brightness and zero heaviness was perfect to start the day or for a light afternoon pick-me-up. Brewed it as guided and every sip was refreshing and nuanced. If you love subtle premium teas, this is a must-try!\nTheir premium white tea (Silver Needle) is also highly recommended and makes for a perfect gift for your discerning friends and family.',
    avatar: '/reviews/s-thapa-avatar.webp',
    photos: [
      { thumb: '/reviews/s-thapa-1-thumb.webp', full: '/reviews/s-thapa-1.webp' },
      { thumb: '/reviews/s-thapa-2-thumb.webp', full: '/reviews/s-thapa-2.webp' },
    ],
    ownerReply: "Thank you Mr. Thapa. We're extremely glad you liked our collection and described it in a most poetic way possible.\nHope to see you really soon. Happy Sipping 🍵",
  },
  {
    id: 'jimi-roy-sarkar',
    author: 'Jimi Roy Sarkar',
    rating: 5,
    when: '9 months ago',
    text: 'Very good quality Darjeeling tea variants...\nReally liked the aroma of the product...',
    avatar: '/reviews/jimi-roy-sarkar-avatar.webp',
    photos: [
      { thumb: '/reviews/jimi-roy-sarkar-1-thumb.webp', full: '/reviews/jimi-roy-sarkar-1.webp' },
    ],
    ownerReply: 'Glad you like our product and please do visit us again. Happy Sipping 🫖',
  },
  {
    id: 'gloriya-rai',
    author: 'Gloriya Rai',
    rating: 5,
    when: '9 months ago',
    text: 'Elegant Sip tea offers a light, refined cup with classic floral and muscatel notes. Perfect for those who enjoy authentic Darjeeling tea without milk...and the gift pack was good with budget friendly.... And the taste was awesome',
    avatar: '/reviews/gloriya-rai-avatar.webp',
    ownerReply: 'We appreciate your time for the review, and glad you liked our gift pack and the tea. Happy Sipping 🫖',
  },
  {
    id: 'vaani-vandhana-allay',
    author: 'Vaani Vandhana Allay',
    rating: 5,
    when: '9 months ago',
    text: "'Elegant Sip' keeps me feeling fresh and rejuvenated, whether it's early morning, afternoon, or evening. Maybe it's the super organic ingredients, but I'm loving it! The price is reasonable too. I look forward to sipping this tea and enjoying the freshness and aroma of a true Himalayan experience 😊",
    avatar: '/reviews/vaani-vandhana-allay-avatar.webp',
    photos: [
      { thumb: '/reviews/vaani-vandhana-allay-1-thumb.webp', full: '/reviews/vaani-vandhana-allay-1.webp' },
    ],
    ownerReply: 'Glad you liked our collection of teas. Hoping to continue this journey together. 🙏🏼 Have a tea-rrffic day ahead.',
  },
  {
    id: 'samiksha-rai',
    author: 'samiksha rai',
    rating: 5,
    when: '9 months ago',
    text: 'Highly recommended for its high quality. I along with my family have been drinking it since the last three months, the packaging is so nice that we prefer for the gifting purpose as well… well packaged and super quality…👍',
    avatar: '/reviews/samiksha-rai-avatar.webp',
    ownerReply: 'Thank you for such a warm reply. Glad you liked our gift collection, we take pride in our packaging. Happy Sipping 🍵.',
  },
  {
    id: 'narbu-lepcha',
    author: 'Narbu Lepcha',
    rating: 5,
    when: '9 months ago',
    text: 'The tea taste great.... You find premium tea at minimum cost... Suggest to try atleast once....',
    avatar: '/reviews/narbu-lepcha-avatar.webp',
    ownerReply: 'Glad you liked our tea collection and our pricing. Happy Sipping 🍵',
  },
  {
    id: 'pratik-lama',
    author: 'PRATIK LAMA',
    rating: 5,
    when: '9 months ago',
    text: 'I personally feel that the tea leaves genuinely tastes very very good.',
    avatar: '/reviews/pratik-lama-avatar.webp',
    ownerReply: 'Thank you Pratik for your lovely feedback. Hope you see you back again 🫖',
  },
  {
    id: 'satyen-bardewa',
    author: 'Satyen Bardewa',
    rating: 5,
    when: '9 months ago',
    text: 'Enjoy the freshness of Garden Tea from Darjeeling Hills with Elegant Sip, a journey from freshness to relaxation with budget friendly👍',
    avatar: '/reviews/satyen-bardewa-avatar.webp',
    ownerReply: 'Glad you liked our collection and the price range. Happy Sipping 🫖',
  },
  {
    id: 'prabir-kumar-das',
    author: 'Prabir kumar Das',
    rating: 5,
    when: '9 months ago',
    text: 'White tea is the best...thank you Elegant sip for this lovely morning',
    avatar: '/reviews/prabir-kumar-das-avatar.webp',
    ownerReply: 'Glad you liked our white tea collection. Hope to see you really soon, till then happy Sipping 🍵',
  },
  {
    id: 'bandwita-allay',
    author: 'Bandwita Allay',
    rating: 5,
    when: '10 months ago',
    text: 'Silver tea , first flush, 2nd flush, green tea and broken tea ...must try',
    avatar: '/reviews/bandwita-allay-avatar.webp',
    ownerReply: "It's overwheling, hearing such good things about our variety of tea. Glad you liked it so much. Hope we become best-teas soon 😉",
  },
  {
    id: 'kavita-tewari',
    author: 'Kavita Tewari',
    rating: 5,
    when: '8 months ago',
    text: 'Tea leaves are genuinely refreshing..',
    avatar: '/reviews/kavita-tewari-avatar.webp',
    ownerReply: 'Thank you so much. Happy Sipping🫖',
  },
  {
    id: 'mousumi-roy',
    author: 'Mousumi Roy',
    rating: 5,
    when: '9 months ago',
    text: 'Very tasty tea',
    avatar: '/reviews/mousumi-roy-avatar.webp',
    ownerReply: 'Glad you liked our collection. Hope to see you again soon. Happy Sipping 🫖',
  },
  {
    id: 'subhendu-kundu',
    author: 'Subhendu Kundu',
    rating: 5,
    when: '10 months ago',
    text: 'Elegant taste at best price',
    avatar: '/reviews/subhendu-kundu-avatar.webp',
    ownerReply: 'Glad you liked our collection. Hope you had a tea-rrffic time while drinking our tea. Do return for more par-tea. 😉',
  },
  {
    id: 'm-morales',
    author: 'M. Morales',
    rating: 5,
    when: '9 months ago',
    text: 'A friend gifted this tea to my family and me in Spain. We enjoy many different types of teas, and it has been a wonderful discovery.\nYou can taste a high-quality tea with a natural and refreshing flavor. It offers a light and refined aroma, and we all love it. I believe the shop is in Darjeeling, and if I ever visit, I will definitely stop by to stock up for the whole family.',
    avatar: '/reviews/m-morales-avatar.webp',
    photos: [
      { thumb: '/reviews/m-morales-1-thumb.webp', full: '/reviews/m-morales-1.webp' },
    ],
    ownerReply: "Thank you so much Ms. Morales. It's been a true pleasure that you liked it so much and our tea has reached beyond boundaries and across oceans.\nWe will be more than glad to host you whenever you are here and can taste our fresh tea.\nHappy Sipping 🍵",
  },
  {
    id: 'ajit-kumar-biswas',
    author: 'Ajit kumar Biswas',
    rating: 5,
    when: '4 months ago',
    avatar: '/reviews/ajit-kumar-biswas-avatar.webp',
  },
  {
    id: 'bpcmirik-block',
    author: 'BPCMIRIK BLOCK',
    rating: 5,
    when: '9 months ago',
    avatar: '/reviews/bpcmirik-block-avatar.webp',
  },
  {
    id: 'ashim-subba',
    author: 'Ashim Subba',
    rating: 5,
    when: '9 months ago',
    avatar: '/reviews/ashim-subba-avatar.webp',
  },
  {
    id: 'mahendra-chettri',
    author: 'Mahendra Chettri',
    rating: 5,
    when: '9 months ago',
    avatar: '/reviews/mahendra-chettri-avatar.webp',
  },
]
