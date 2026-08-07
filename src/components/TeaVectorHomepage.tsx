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

/** Scene 2 · Symmetrical line-art tea bush tree matching reference image */
const STEMS = [
  // Central main trunk (rising from base center)
  'M 960 1020 L 960 260',
  // Top branch forks
  'M 960 360 C 920 320 870 270 840 240',
  'M 960 360 C 1000 320 1050 270 1080 240',
  // Upper branch forks
  'M 960 480 C 880 440 790 390 720 360',
  'M 960 480 C 1040 440 1130 390 1200 360',
  // Mid branch forks
  'M 960 640 C 860 600 740 550 640 520',
  'M 960 640 C 1060 600 1180 550 1280 520',
  // Lower branch forks
  'M 960 800 C 870 770 790 740 750 720',
  'M 960 800 C 1050 770 1130 740 1170 720',
]

/** Distant background tea hill terraces (clean, soft backdrop) */
const TERRACE_LINES = [
  'M -50 720 C 350 680 750 640 1050 680 S 1650 740 1970 700',
  'M -50 820 C 450 790 850 770 1200 810 S 1750 860 1970 830',
  'M 1200 620 C 1450 660 1730 690 1970 715',
]

/** Pointed oval leaf outline */
const LEAF_OUTLINE_D = 'M 0 0 C -20 -30 -30 -70 0 -100 C 30 -70 20 -30 0 0 Z'

/** Central midrib + herringbone side veins inside each leaf */
const LEAF_HERRINGBONE_VEINS = [
  'M 0 0 L 0 -95',
  'M 0 -22 L -14 -34',
  'M 0 -22 L 14 -34',
  'M 0 -44 L -18 -58',
  'M 0 -44 L 18 -58',
  'M 0 -66 L -14 -78',
  'M 0 -66 L 14 -78',
].join(' ')

interface LeafSpot {
  x: number
  y: number
  rot: number
  scale: number
}

/** Leaves attached cleanly along branch nodes and tips */
const LEAF_SPOTS: LeafSpot[] = [
  // Apex shoot ("Two leaves and a bud" at top tip)
  { x: 960, y: 240, rot: 0, scale: 0.85 },
  { x: 935, y: 270, rot: -35, scale: 0.95 },
  { x: 985, y: 270, rot: 35, scale: 0.95 },

  // Central Trunk Leaves
  { x: 935, y: 380, rot: -45, scale: 1.0 },
  { x: 985, y: 380, rot: 45, scale: 1.0 },
  { x: 935, y: 500, rot: -45, scale: 1.05 },
  { x: 985, y: 500, rot: 45, scale: 1.05 },
  { x: 935, y: 660, rot: -50, scale: 1.1 },
  { x: 985, y: 660, rot: 50, scale: 1.1 },

  // Top Left Branch Leaves
  { x: 890, y: 290, rot: -40, scale: 0.9 },
  { x: 840, y: 240, rot: -55, scale: 0.95 },
  { x: 805, y: 255, rot: -25, scale: 0.85 },

  // Top Right Branch Leaves
  { x: 1030, y: 290, rot: 40, scale: 0.9 },
  { x: 1080, y: 240, rot: 55, scale: 0.95 },
  { x: 1115, y: 255, rot: 25, scale: 0.85 },

  // Upper Left Branch Leaves
  { x: 840, y: 410, rot: -50, scale: 0.95 },
  { x: 780, y: 380, rot: -60, scale: 1.0 },
  { x: 720, y: 360, rot: -75, scale: 1.05 },
  { x: 685, y: 385, rot: -40, scale: 0.9 },

  // Upper Right Branch Leaves
  { x: 1080, y: 410, rot: 50, scale: 0.95 },
  { x: 1140, y: 380, rot: 60, scale: 1.0 },
  { x: 1200, y: 360, rot: 75, scale: 1.05 },
  { x: 1235, y: 385, rot: 40, scale: 0.9 },

  // Mid Left Branch Leaves
  { x: 800, y: 580, rot: -55, scale: 1.0 },
  { x: 720, y: 540, rot: -65, scale: 1.05 },
  { x: 640, y: 520, rot: -80, scale: 1.1 },
  { x: 605, y: 550, rot: -45, scale: 0.95 },

  // Mid Right Branch Leaves
  { x: 1120, y: 580, rot: 55, scale: 1.0 },
  { x: 1200, y: 540, rot: 65, scale: 1.05 },
  { x: 1280, y: 520, rot: 80, scale: 1.1 },
  { x: 1315, y: 550, rot: 45, scale: 0.95 },

  // Lower Left Branch Leaves
  { x: 860, y: 760, rot: -60, scale: 1.05 },
  { x: 790, y: 735, rot: -70, scale: 1.1 },
  { x: 750, y: 720, rot: -85, scale: 1.15 },
  { x: 715, y: 755, rot: -50, scale: 1.0 },

  // Lower Right Branch Leaves
  { x: 1060, y: 760, rot: 60, scale: 1.05 },
  { x: 1130, y: 735, rot: 70, scale: 1.1 },
  { x: 1170, y: 720, rot: 85, scale: 1.15 },
  { x: 1205, y: 755, rot: 50, scale: 1.0 },
]

/** Tea flower bud / berry clusters at branch axils */
interface BerryCluster {
  x: number
  y: number
  scale: number
}

const BERRY_CLUSTERS: BerryCluster[] = [
  { x: 920, y: 795, scale: 1 },
  { x: 995, y: 705, scale: 1 },
  { x: 915, y: 565, scale: 0.9 },
  { x: 1000, y: 445, scale: 0.9 },
  { x: 922, y: 325, scale: 0.8 },
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
  'M 930 660 C 900 610 950 575 925 525 S 890 455 930 415',
  'M 1000 650 C 1030 600 980 565 1005 515 S 1040 445 1000 405',
]
const STEAM_ALT = [
  'M 880 320 C 855 245 895 215 900 138 S 845 35 855 -25',
  'M 1040 340 C 1065 255 1025 225 1025 148 S 1085 45 1080 -15',
  'M 960 300 C 945 225 975 195 930 118 S 935 15 940 -45',
  'M 930 660 C 915 605 935 580 950 522 S 905 450 905 410',
  'M 1000 650 C 1015 595 995 570 980 512 S 1025 440 1025 400',
]

/** Scene 4 · motion-blur trails flanking the leaf's fall line. */
const TRAILS = [
  'M 880 430 C 820 540 900 620 850 720',
  'M 1040 450 C 1100 560 1020 640 1070 740',
  'M 960 400 C 900 500 1010 600 955 700',
]

/** Scene 5 · glass cup line art + the interior shape used to clip the liquid. */
const CUP_BODY_D = 'M 810 700 L 830 940 C 833 972 880 990 960 990 C 1040 990 1087 972 1090 940 L 1110 700'
const CUP_SAUCER_D = 'M 850 1016 C 900 1038 1020 1038 1070 1016'
const CUP_CLIP_D =
  'M 822 715 L 840 935 C 843 962 890 978 960 978 C 1030 978 1077 962 1080 935 L 1098 715 Z'

/**
 * Scene 5 · the water's surface. Two wave shapes with identical command
 * structures — GSAP yoyo-morphs the `d` attribute between them for a
 * continuous slosh once the leaf breaks the surface. The filled band sits on
 * top of the liquid rect (same fill, so they read as one body of water).
 */
const WAVE_A =
  'M 810 732 C 860 716 910 748 960 732 C 1010 716 1060 748 1110 732 L 1110 780 L 810 780 Z'
const WAVE_B =
  'M 810 736 C 860 752 910 720 960 736 C 1010 752 1060 720 1110 736 L 1110 780 L 810 780 Z'

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
        .to(heroLeaf, { y: 890, scale: 0.35, rotation: 810, duration: 0.15, ease: 'power2.in' }, 4.4)
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
        .to(heroLeaf, { x: 952, y: 930, rotation: 850, duration: 0.35, ease: 'power1.out' }, 4.6)
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
            x={800}
            y={740}
            width={320}
            height={250}
            clipPath="url(#cup-clip)"
            fill="#cfe3dd"
          />
          {/* sloshing surface band — overlaps the rect top so they read as one */}
          <path ref={waveRef} d={WAVE_A} clipPath="url(#cup-clip)" fill="#cfe3dd" />
          <path className="cup-line" d={CUP_BODY_D} stroke="#2a3630" strokeWidth={5} strokeLinecap="round" />
          <ellipse className="cup-line" cx={960} cy={700} rx={150} ry={26} stroke="#2a3630" strokeWidth={4} />
          <path className="cup-line" d={CUP_SAUCER_D} stroke="#2a3630" strokeWidth={4} strokeLinecap="round" />
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
            <circle key={i} className="ripple" cx={960} cy={740} r={20} stroke="#d48806" strokeWidth={3} />
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
