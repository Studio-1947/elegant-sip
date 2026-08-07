import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { useGSAP } from '@gsap/react'

import { SCROLL_TRIGGER_DEFAULTS, SCENE_COUNT } from '../scrollConfig'

// DrawSVGPlugin has been part of the free public gsap package since 3.13.
gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin)

/* ────────────────────────────────────────────────────────────────────────── */
/* Vector data — all geometry lives in a 1920×1080 viewBox                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Scene 1 · Mountain terrain contour lines (positioned along the bottom of Chapter 1) */
const RIDGES = [
  // Top curve with peak on left-center, dipping & intersecting on right
  'M -50 680 C 400 420 700 440 1000 620 C 1300 780 1550 550 1970 480',
  // Upper-mid curve gently rising across center and dipping right
  'M -50 720 C 500 780 950 660 1450 600 C 1680 570 1850 700 1970 750',
  // Lower-mid curve with central peak, dipping mid-right and rising right
  'M -50 860 C 320 640 580 640 880 830 C 1180 1000 1520 860 1970 700',
  // Bottom curve swooping down lower-middle and rising up right
  'M -50 800 C 480 970 980 900 1480 840 C 1680 810 1850 910 1970 960',
]

/** Scene 1 · Alternate morph target for continuous ambient mountain wave animation */
const RIDGES_ALT = [
  'M -50 660 C 430 450 670 410 1000 645 C 1270 750 1580 520 1970 495',
  'M -50 735 C 470 750 970 680 1450 580 C 1710 580 1830 680 1970 730',
  'M -50 840 C 350 660 550 610 880 850 C 1150 980 1540 830 1970 715',
  'M -50 815 C 450 940 1000 920 1480 820 C 1660 830 1870 890 1970 945',
]

/** Scene 1 · Sleek vector cloud path matching new reference image (flat base, rounded lobes) */
const CLOUD_OUTLINE_D =
  'M 20 0 C -45 0 -70 -40 -50 -75 C -35 -100 -5 -115 15 -110 C 25 -150 65 -185 115 -185 C 135 -185 155 -178 170 -165 C 190 -210 235 -240 290 -240 C 350 -240 400 -200 415 -145 C 440 -150 470 -135 485 -110 C 510 -75 490 0 430 0 Z'

interface CloudSpot {
  x: number
  y: number
  scale: number
}

/** Positions for clouds flanking the title at the text horizontal level */
const CLOUD_SPOTS: CloudSpot[] = [
  { x: 60, y: 320, scale: 0.55 },
  { x: 1410, y: 320, scale: 0.55 },
]

/** Distant background tea hill terraces (clean, soft backdrop) */
const TERRACE_LINES = [
  'M -50 720 C 350 680 750 640 1050 680 S 1650 740 1970 700',
  'M -50 820 C 450 790 850 770 1200 810 S 1750 860 1970 830',
  'M 1200 620 C 1450 660 1730 690 1970 715',
]

/** Scene 3 · hero leaf (large close-up), local origin at its stem attachment. */
const HERO_LEAF_D = 'M 0 90 C 85 45 110 -75 0 -190 C -110 -75 -85 45 0 90 Z'
const HERO_VEINS = [
  'M 0 70 L 0 -170',
  'M 0 20 C 30 8 48 -10 62 -40',
  'M 0 20 C -30 8 -48 -10 -62 -40',
  'M 0 -45 C 26 -56 40 -72 50 -96',
  'M 0 -45 C -26 -56 -40 -72 -50 -96',
]

/**
 * Scene 3 · plucker gesture as line art (matches the stroke aesthetic):
 * two arm contour lines flowing in from the right, an index finger and a
 * thumb closing to a pinch just off the hero leaf's tip.
 */
const HAND_LINES = [
  'M 1920 150 C 1740 170 1560 215 1420 280 C 1330 320 1240 345 1150 350',
  'M 1920 300 C 1760 310 1600 340 1470 385 C 1390 412 1310 425 1230 420',
  'M 1150 350 C 1090 352 1035 335 1000 300 C 988 288 990 272 1005 268 C 1020 264 1040 274 1052 288',
  'M 1230 420 C 1165 418 1105 395 1062 358 C 1050 347 1052 332 1066 328',
]

/**
 * Scene 3 + 5 · steam paths and their morph targets. Base and alt strings have
 * identical command structures, so GSAP can interpolate the raw `d` attribute
 * for a continuous flowing morph — no MorphSVG needed.
 * Indices 0–2 swirl around the hero leaf; 3–4 rise from the finished cup.
 */
const STEAM_D = [
  'M 880 320 C 830 250 920 210 875 140 S 820 40 880 -20',
  'M 1040 340 C 1090 260 1000 220 1050 150 S 1110 50 1055 -10',
  'M 960 300 C 920 230 1000 190 955 120 S 910 20 965 -40',
  'M 930 760 C 900 710 950 675 925 625 S 890 555 930 515',
  'M 1000 750 C 1030 700 980 665 1005 615 S 1040 545 1000 505',
]
const STEAM_ALT = [
  'M 880 320 C 855 245 895 215 900 138 S 845 35 855 -25',
  'M 1040 340 C 1065 255 1025 225 1025 148 S 1085 45 1080 -15',
  'M 960 300 C 945 225 975 195 930 118 S 935 15 940 -45',
  'M 930 760 C 915 705 935 680 950 622 S 905 550 905 510',
  'M 1000 750 C 1015 695 995 670 980 612 S 1025 540 1025 500',
]

/** Scene 4 · motion-blur trails flanking the leaf's fall line. */
const TRAILS = [
  'M 880 430 C 820 540 900 620 850 720',
  'M 1040 450 C 1100 560 1020 640 1070 740',
  'M 960 400 C 900 500 1010 600 955 700',
]

/** Scene 5 · classic shallow teacup line art + handle + saucer + interior clip path. */
const CUP_BODY_D = 'M 800 800 C 800 895 870 935 960 935 C 1050 935 1120 895 1120 800'
const CUP_HANDLE_D = 'M 1115 822 C 1185 822 1185 890 1085 890'
const CUP_SAUCER_D = 'M 750 935 C 830 962 1090 962 1170 935'
const CUP_CLIP_D = 'M 802 805 C 802 890 870 928 960 928 C 1050 928 1118 890 1118 805 Z'

/** Water surface slosh morph */
const WAVE_A =
  'M 800 820 C 840 808 880 832 960 820 C 1040 808 1080 832 1120 820 L 1120 940 L 800 940 Z'
const WAVE_B =
  'M 800 824 C 840 836 880 812 960 824 C 1040 836 1080 812 1120 824 L 1120 940 L 800 940 Z'

/* ────────────────────────────────────────────────────────────────────────── */
/* HTML caption copy                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

interface Caption {
  id: string
  pos: string
  eyebrow: string
  title: string
  titleClass: string
  body: string
}

const CAPTIONS: Caption[] = [
  {
    id: 'caption-1',
    pos: 'inset-x-0 top-24 flex flex-col items-center justify-center text-center md:top-28',
    eyebrow: 'Chapter I · The Terroir',
    title: 'ELEGANTSIP',
    titleClass: 'text-6xl md:text-8xl tracking-[0.12em]',
    body: 'Two thousand metres up, where clouds graze the ridgeline, our gardens wake slowly.',
  },
  {
    id: 'caption-2',
    pos: 'left-6 top-1/2 max-w-sm -translate-y-1/2 md:left-20',
    eyebrow: 'Chapter II · The Flush',
    title: 'Two Leaves & a Bud',
    titleClass: 'text-4xl md:text-6xl',
    body: 'Spring rain draws new growth from old wood — the first flush reaches for the light.',
  },
  {
    id: 'caption-3',
    pos: 'left-6 top-1/2 max-w-sm -translate-y-1/2 md:left-20',
    eyebrow: 'Chapter III · The Pluck',
    title: 'Chosen by Hand',
    titleClass: 'text-4xl md:text-6xl',
    body: 'A practised pinch, a quiet snap. Only the tenderest leaf makes the basket.',
  },
  {
    id: 'caption-4',
    pos: 'right-6 top-1/2 max-w-sm -translate-y-1/2 text-right md:right-20',
    eyebrow: 'Chapter IV · The Turn',
    title: 'Green Gives Way to Gold',
    titleClass: 'text-4xl md:text-6xl',
    body: 'Bruised and breathing, the leaf oxidises — chlorophyll surrendering to amber.',
  },
  {
    id: 'caption-5',
    pos: 'right-6 bottom-20 max-w-sm text-right md:right-20',
    eyebrow: 'Chapter V · The Infusion',
    title: 'The Golden Cup',
    titleClass: 'text-4xl md:text-6xl',
    body: 'Ninety seconds in living water, and the mountain finally speaks.',
  },
]

const SECTIONS = ['terrain', 'growth', 'pluck', 'oxidation', 'infusion']

/* ────────────────────────────────────────────────────────────────────────── */
/* Component                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * TeaVectorHomepage — the whole experience: fixed SVG stage, HTML captions,
 * a 500vh scroll runway, and one scrubbed GSAP master timeline.
 *
 * Timebase: 1 timeline-second per scene; scene N occupies [N-1, N].
 */
export default function TeaVectorHomepage() {
  const rootRef = useRef<HTMLDivElement>(null)

  // Strictly typed refs for the elements the timeline drives directly.
  const mountainsRef = useRef<SVGGElement>(null)
  const plantRef = useRef<SVGGElement>(null)
  const heroLeafRef = useRef<SVGGElement>(null)
  const heroLeafBodyRef = useRef<SVGPathElement>(null)
  const handRef = useRef<SVGGElement>(null)
  const cupRef = useRef<SVGGElement>(null)
  const liquidRef = useRef<SVGRectElement>(null)
  const waveRef = useRef<SVGPathElement>(null)

  useGSAP(
    () => {
      const heroLeaf = heroLeafRef.current
      const leafBody = heroLeafBodyRef.current
      const liquid = liquidRef.current
      const wave = waveRef.current
      if (!heroLeaf || !leafBody || !liquid || !wave) return

      /* ── Initial states, applied synchronously at mount ─────────────────
       * Everything is authored in its FINAL position; gsap.set() winds each
       * element back to its pre-scene state. Doing this outside the timeline
       * (rather than with fromTo) sidesteps every immediateRender surprise. */
      gsap.set(
        '.ridge, .terrace-line, .stem, .leaf-outline, .leaf-vein, .hero-vein, .steam, .trail, .cup-line, .hand-line',
        {
          drawSVG: '0% 0%',
        },
      )
      gsap.set('.leaf', { scale: 0, transformOrigin: '50% 100%' })
      gsap.set('.berry-cluster', { scale: 0, transformOrigin: '50% 50%' })
      gsap.set(heroLeaf, { scale: 0, transformOrigin: '50% 50%' })
      gsap.set(handRef.current, { x: 400, autoAlpha: 0 })
      gsap.set(liquid, { y: 60, fillOpacity: 0 })
      gsap.set(wave, { autoAlpha: 0, fillOpacity: 0.25 })
      gsap.set('.ripple', { attr: { r: 20 }, autoAlpha: 0 })
      gsap.set('#plant-scene, #hero-scene, #cup-scene', { autoAlpha: 0 })

      /* ── Ambient loops (mount-time, NOT scroll-scrubbed) ────────────────
       * Continuous organic morphing of mountain contours, steam, and water.
       * Base and alt `d` strings share command structure for smooth morphing. */
      gsap.to('.ridge', {
        attr: { d: (i: number) => RIDGES_ALT[i] },
        duration: 4.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.35,
      })
      gsap.to('.steam', {
        attr: { d: (i: number) => STEAM_ALT[i] },
        duration: 3,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.4,
      })
      gsap.to('.cloud', {
        x: (i: number) => (i % 2 === 0 ? '+=45' : '-=35'),
        y: (i: number) => (i % 2 === 0 ? '-=15' : '+=12'),
        duration: 6.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.6,
      })
      // The water's slosh runs on real time too (it's invisible until impact
      // flips the wave's autoAlpha on, so the loop can simply always run).
      gsap.to(wave, { attr: { d: WAVE_B }, duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true })

      // Mount intro (NOT scroll-scrubbed): landing view mountain contours draw
      // on load matching reference image, and caption fades in with them.
      gsap
        .timeline({ defaults: { ease: 'power2.inOut' } })
        .to('.ridge', { drawSVG: '0% 100%', duration: 1.2, stagger: 0.15 }, 0)
        .from('#caption-1', { autoAlpha: 0, y: 30, duration: 1.2, ease: 'power2.out' }, 0.2)

      /* ── Master timeline ──────────────────────────────────────────────── */
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { ...SCROLL_TRIGGER_DEFAULTS },
      })

      const captionIn = (id: string, at: number) =>
        tl.fromTo(id, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2, immediateRender: false }, at)
      const captionOut = (id: string, at: number) =>
        tl.to(id, { autoAlpha: 0, y: -30, duration: 0.15 }, at)

      /* ---- Scene 1 (0–1) · Vector mountain terrain ---------------------- */
      // (The ridge draw-on happens in the mount intro above.) Scroll drives a
      // gentle parallax: near ridges drift faster than far ones.
      tl.to('.ridge', { x: (i: number) => -30 - i * 25, duration: 0.6 }, 0.25)
      tl.to('#scroll-hint', { autoAlpha: 0, duration: 0.08 }, 0.06)
      captionOut('#caption-1', 0.78)
      // The mountains stay as a faint backdrop for the rest of the story.
      tl.to(mountainsRef.current, { autoAlpha: 0.12, duration: 0.2 }, 0.86)

      /* ---- Scene 2 (1–2) · Authentic Tea Plant Growth (from uploaded SVG) - */
      tl.to('#plant-scene', { autoAlpha: 1, duration: 0.05 }, 1)
        // Background terrace hill lines draw on
        .to('.terrace-line', { drawSVG: '0% 100%', duration: 0.35, stagger: 0.05 }, 1.0)
        // Authentic tea plant scales up & fades in smoothly
        .fromTo(
          '#tea-plant-svg',
          { scale: 0.6, autoAlpha: 0, transformOrigin: '50% 100%' },
          { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'back.out(1.4)' },
          1.05,
        )
      captionIn('#caption-2', 1.2)
      captionOut('#caption-2', 1.8)

      /* ---- Scene 3 (2–3) · Chapter III (vector animation temporarily removed) - */
      tl.to(plantRef.current, { autoAlpha: 0, duration: 0.3 }, 2)
      tl.to('#hero-scene', { autoAlpha: 0, duration: 1 }, 2)
      captionIn('#caption-3', 2.2)
      captionOut('#caption-3', 2.8)

      /* ---- Scene 4 (3–4) · Rotating fall & colour morph ----------------- */
      // The leaf detaches: two full turns about its own 2D centre as it falls.
      // NOTE: GSAP absorbed the group's authored translate(960 460) as x/y, so
      // these are ABSOLUTE stage coordinates, not offsets — y: 660 is 200 down.
      tl.to(heroLeaf, { y: 660, rotation: 720, scale: 0.55, duration: 0.95, ease: 'power1.inOut' }, 3)
        // THE signature interpolation: GSAP tweens the SVG fill through colour
        // space from raw green (#4CAF50) to oxidised amber (#D48806).
        .to(leafBody, { fill: '#D48806', duration: 0.8, ease: 'power1.in' }, 3.05)
        .to('.hero-vein', { stroke: '#8a5a10', duration: 0.8 }, 3.05)
        // Motion-blur trails draw down the fall line, then dissolve.
        .to('.trail', { drawSVG: '0% 100%', duration: 0.45, stagger: 0.1 }, 3.05)
        .to('.trail', { autoAlpha: 0, duration: 0.2 }, 3.75)
      captionIn('#caption-4', 3.15)
      captionOut('#caption-4', 3.75)

      /* ---- Scene 5 (4–5) · Glass cup & liquid infusion ------------------ */
      tl.to('#cup-scene', { autoAlpha: 1, duration: 0.05 }, 4)
        // The cup draws itself as pure line art.
        .to('.cup-line', { drawSVG: '0% 100%', duration: 0.35, stagger: 0.05, ease: 'power1.inOut' }, 4.02)
        // Clear water settles in (a clipped rect rising behind the outline).
        .to(liquid, { y: 0, fillOpacity: 0.25, duration: 0.15 }, 4.3)
        // The leaf plunges straight down the cup's centre axis (x stays 960) —
        // impact lands at t = 4.55. (Absolute stage coordinates, see scene 4.)
        .to(heroLeaf, { y: 820, scale: 0.35, rotation: 810, duration: 0.15, ease: 'power2.in' }, 4.4)
        // Ripple rings radiate from the impact point. immediateRender: false is
        // essential — otherwise the "from" state (visible rings) renders at load.
        .fromTo(
          '.ripple',
          { attr: { r: 20 }, autoAlpha: 0.9 },
          { attr: { r: 380 }, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: 'power1.out', immediateRender: false },
          4.55,
        )
        // The surface starts sloshing the instant the leaf breaks it (the wave
        // morph loop is already running on real time — this just reveals it).
        .to(wave, { autoAlpha: 1, duration: 0.04 }, 4.55)
        // The infusion: liquid + wave fills interpolate together from
        // near-clear to the rich tea colour — the cup "steeps".
        .to([liquid, wave], { fill: '#9E4712', fillOpacity: 0.82, duration: 0.4, ease: 'power1.inOut' }, 4.55)
        // The leaf settles to the bottom of the cup.
        .to(heroLeaf, { x: 952, y: 885, rotation: 850, duration: 0.35, ease: 'power1.out' }, 4.6)
        // A final curl of steam rises from the finished cup.
        .to('.cup-steam', { drawSVG: '0% 100%', duration: 0.25, stagger: 0.08 }, 4.7)
      captionIn('#caption-5', 4.68)
    },
    { scope: rootRef },
  )

  return (
    <div ref={rootRef} className="bg-white text-[#1c2620]">
      {/* z-10 · the fixed SVG stage — every story visual is a vector in here */}
      <svg
        className="pointer-events-none fixed inset-0 z-10 h-full w-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden
      >
        <defs>
          {/* soft glow for the aroma paths */}
          <filter id="steam-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* confines the liquid to the cup's interior silhouette */}
          <clipPath id="cup-clip">
            <path d={CUP_CLIP_D} />
          </clipPath>
          {/* crops stray margin marks from the tea plant graphic */}
          <clipPath id="plant-crop">
            <rect x="735" y="260" width="500" height="560" />
          </clipPath>
        </defs>

        {/* ── Scene 1 · mountain terrain contour lines & hand-drawn ink clouds ── */}
        <g ref={mountainsRef} id="mountain-scene">
          {/* Mountain terrain contour lines */}
          {RIDGES.map((d, i) => (
            <path
              key={d}
              className="ridge"
              d={d}
              stroke="#1c2620"
              strokeWidth={4.2 - i * 0.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Sleek vector clouds matching reference image (flat base, thick border, offset shadow) */}
          {CLOUD_SPOTS.map((c, i) => (
            <g key={i} className="cloud" transform={`translate(${c.x} ${c.y}) scale(${c.scale})`}>
              {/* Offset shadow backdrop layer */}
              <path
                d={CLOUD_OUTLINE_D}
                fill="#d8e0da"
                stroke="#c5d0c8"
                strokeWidth={5.5 / c.scale}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform="translate(-6, 7)"
              />
              {/* Main crisp white cloud body with thick dark outline */}
              <path
                d={CLOUD_OUTLINE_D}
                fill="#ffffff"
                stroke="#1c2620"
                strokeWidth={5.5 / c.scale}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>

        {/* ── Scene 2 · tea plant (refined single branch vector line art) ───────── */}
        <g ref={plantRef} id="plant-scene">
          {/* Soft distant terrace lines */}
          {TERRACE_LINES.map((d, i) => (
            <path
              key={i}
              className="terrace-line"
              d={d}
              stroke="#2a3630"
              strokeWidth={1.8 - i * 0.25}
              opacity={0.35}
            />
          ))}

          {/* Authentic tea plant vector graphic from uploaded teaplant.svg */}
          <image
            id="tea-plant-svg"
            href="/teaplant.svg"
            x="680"
            y="260"
            width="560"
            height="560"
            preserveAspectRatio="xMidYMid meet"
            clipPath="url(#plant-crop)"
            style={{ mixBlendMode: 'multiply' }}
          />
        </g>

        {/* ── Scenes 3–5 · hero leaf, plucker, aroma ─────────────────────── */}
        <g id="hero-scene">
          <g ref={heroLeafRef} transform="translate(960 460)">
            <path ref={heroLeafBodyRef} id="hero-leaf-body" d={HERO_LEAF_D} fill="#4CAF50" />
            {HERO_VEINS.map((d) => (
              <path key={d} className="hero-vein" d={d} stroke="#2e7031" strokeWidth={3} strokeLinecap="round" />
            ))}
          </g>
          <g id="leaf-steam" filter="url(#steam-glow)">
            {STEAM_D.slice(0, 3).map((d) => (
              <path key={d} className="steam" d={d} stroke="#b0a489" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
            ))}
          </g>
          <g ref={handRef}>
            {HAND_LINES.map((d) => (
              <path key={d} className="hand-line" d={d} stroke="#2a3630" strokeWidth={3.5} strokeLinecap="round" />
            ))}
          </g>
          {TRAILS.map((d) => (
            <path key={d} className="trail" d={d} stroke="#d48806" strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />
          ))}
        </g>

        {/* ── Scene 5 · glass cup & infusion ─────────────────────────────── */}
        {/* centred, so the leaf's straight-down fall lands mid-cup */}
        <g ref={cupRef} id="cup-scene">
          {/* liquid first, outline on top, so the line art stays crisp */}
          <rect
            ref={liquidRef}
            x={780}
            y={800}
            width={360}
            height={140}
            clipPath="url(#cup-clip)"
            fill="#cfe3dd"
          />
          {/* sloshing surface band — overlaps the rect top so they read as one */}
          <path ref={waveRef} d={WAVE_A} clipPath="url(#cup-clip)" fill="#cfe3dd" />
          
          {/* Teacup saucer dish */}
          <path className="cup-line" d={CUP_SAUCER_D} stroke="#1c2620" strokeWidth={4} strokeLinecap="round" />
          
          {/* Teacup main body bowl */}
          <path className="cup-line" d={CUP_BODY_D} stroke="#1c2620" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          
          {/* Teacup handle loop */}
          <path className="cup-line" d={CUP_HANDLE_D} stroke="#1c2620" strokeWidth={4.5} strokeLinecap="round" fill="none" />
          
          {/* Teacup top rim lip */}
          <ellipse className="cup-line" cx={960} cy={800} rx={160} ry={24} stroke="#1c2620" strokeWidth={4} fill="none" />

          <g filter="url(#steam-glow)">
            {STEAM_D.slice(3).map((d) => (
              <path
                key={d}
                className="steam cup-steam"
                d={d}
                stroke="#b0a489"
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.75}
              />
            ))}
          </g>
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} className="ripple" cx={960} cy={820} r={20} stroke="#d48806" strokeWidth={3} />
          ))}
        </g>
      </svg>

      {/* z-20 · scroll runway: five invisible 100vh sections drive the scrub */}
      <main id="scroll-track" className="pointer-events-none relative z-20">
        {SECTIONS.map((s) => (
          <section key={s} id={`section-${s}`} className="h-screen" aria-hidden />
        ))}
      </main>

      {/* z-30 · per-scene captions */}
      {CAPTIONS.map((c) => (
        <div
          key={c.id}
          id={c.id}
          className={`pointer-events-none fixed z-30 ${c.id === 'caption-1' ? '' : 'opacity-0'} ${c.pos}`}
        >
          <div className="max-w-2xl px-6">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[#d48806] md:text-sm">{c.eyebrow}</p>
            <h2 className={`mb-4 font-medium leading-tight ${c.titleClass}`}>{c.title}</h2>
            <p className="text-sm leading-relaxed text-[#1c2620]/70 md:text-base">{c.body}</p>
            {c.id === 'caption-5' && (
              <a
                href="#"
                className="pointer-events-auto mt-8 inline-block border border-[#d48806] px-8 py-3 text-xs uppercase tracking-[0.3em] text-[#1c2620] transition-colors hover:bg-[#d48806] hover:text-white"
              >
                Shop the First Flush
              </a>
            )}
          </div>
        </div>
      ))}

      {/* scroll hint — fades within the first few % of scroll */}
      <div id="scroll-hint" className="pointer-events-none fixed inset-x-0 bottom-8 z-30 flex justify-center">
        <span className="animate-pulse text-xs uppercase tracking-[0.3em] text-[#1c2620]/50">
          Scroll to steep · {SCENE_COUNT} chapters
        </span>
      </div>
    </div>
  )
}
