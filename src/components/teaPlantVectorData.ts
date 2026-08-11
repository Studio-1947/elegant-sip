/**
 * teaPlantVectorData.ts
 * Exact vector geometry matching the line-art tea plant illustration in teaplant.svg.
 * All coordinates live in the 1920×1080 viewBox stage.
 */

export interface LeafData {
  id: string
  /** Outline path of the leaf */
  d: string
  /** Main central vein path */
  centerVein: string
  /** Delicate side vein paths */
  sideVeins: string[]
  /** Transform origin for GSAP scale/bloom animation */
  origin: string
}

export interface BerryCluster {
  id: string
  cx: number
  cy: number
  r: number
}

/** Stems and main structural branches of the tea bush */
export const PLANT_STEMS = [
  // Central main trunk (bottom root to mid-canopy)
  'M 960 740 C 960 670 958 600 960 520 C 962 440 960 360 960 280',
  // Left main sub-trunk
  'M 960 660 C 935 615 895 560 850 490 C 810 435 775 380 740 320',
  // Right main sub-trunk
  'M 960 660 C 985 615 1025 560 1070 490 C 1110 435 1145 380 1180 320',
  // Left lower main branch
  'M 950 620 C 890 595 830 575 770 545 C 720 520 670 470 650 420',
  // Right lower main branch
  'M 970 620 C 1030 595 1090 575 1150 545 C 1200 520 1250 470 1270 420',
  // Left middle outer branch
  'M 875 520 C 815 485 755 435 700 365',
  // Right middle outer branch
  'M 1045 520 C 1105 485 1165 435 1220 365',
  // Left upper inner branch
  'M 960 440 C 920 385 870 340 820 285',
  // Right upper inner branch
  'M 960 440 C 1000 385 1050 340 1100 285',
  // Left top apex branch
  'M 960 350 C 935 295 900 250 865 205',
  // Right top apex branch
  'M 960 350 C 985 295 1020 250 1055 205',
]

/** Helper function to create leaf path data given base, tip, width and curve handles */
function createLeaf(
  id: string,
  bx: number,
  by: number,
  tx: number,
  ty: number,
  spread: number = 22,
): LeafData {
  const mx = (bx + tx) / 2
  const my = (by + ty) / 2
  const dx = tx - bx
  const dy = ty - by
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len

  const ctrl1X = mx + nx * spread
  const ctrl1Y = my + ny * spread
  const ctrl2X = mx - nx * spread
  const ctrl2Y = my - ny * spread

  const d = `M ${bx} ${by} C ${ctrl1X} ${ctrl1Y} ${ctrl1X + (tx - ctrl1X) * 0.5} ${ctrl1Y + (ty - ctrl1Y) * 0.5} ${tx} ${ty} C ${ctrl2X + (tx - ctrl2X) * 0.5} ${ctrl2Y + (ty - ctrl2Y) * 0.5} ${ctrl2X} ${ctrl2Y} ${bx} ${by} Z`
  const centerVein = `M ${bx} ${by} L ${tx} ${ty}`

  // 3 pairs of side veins
  const sideVeins: string[] = []
  const steps = [0.28, 0.52, 0.75]
  steps.forEach((t) => {
    const vx = bx + dx * t
    const vy = by + dy * t
    const vLen = spread * 0.55 * (1 - t * 0.3)
    sideVeins.push(`M ${vx} ${vy} Q ${vx + nx * vLen * 0.7} ${vy + ny * vLen * 0.7} ${vx + nx * vLen + dx * 0.12} ${vy + ny * vLen + dy * 0.12}`)
    sideVeins.push(`M ${vx} ${vy} Q ${vx - nx * vLen * 0.7} ${vy - ny * vLen * 0.7} ${vx - nx * vLen + dx * 0.12} ${vy - ny * vLen + dy * 0.12}`)
  })

  return {
    id,
    d,
    centerVein,
    sideVeins,
    origin: `${bx}px ${by}px`,
  }
}

/** Array of botanically detailed leaves matching teaplant.svg foliage layout */
export const PLANT_LEAVES: LeafData[] = [
  // ── Apex "Two Leaves & a Bud" (Harvest Shoot) ──
  createLeaf('leaf-apex-center', 960, 280, 960, 210, 14),
  createLeaf('leaf-apex-left', 960, 280, 920, 230, 22),
  createLeaf('leaf-apex-right', 960, 280, 1000, 230, 22),

  // ── Top Left Branch Canopy ──
  createLeaf('leaf-tl-1', 865, 205, 830, 155, 20),
  createLeaf('leaf-tl-2', 880, 230, 825, 200, 24),
  createLeaf('leaf-tl-3', 910, 265, 850, 240, 24),
  createLeaf('leaf-tl-4', 935, 295, 875, 280, 22),

  // ── Top Right Branch Canopy ──
  createLeaf('leaf-tr-1', 1055, 205, 1090, 155, 20),
  createLeaf('leaf-tr-2', 1040, 230, 1095, 200, 24),
  createLeaf('leaf-tr-3', 1010, 265, 1070, 240, 24),
  createLeaf('leaf-tr-4', 985, 295, 1045, 280, 22),

  // ── Upper Left Quadrant ──
  createLeaf('leaf-ul-1', 820, 285, 765, 235, 24),
  createLeaf('leaf-ul-2', 845, 315, 790, 275, 26),
  createLeaf('leaf-ul-3', 870, 345, 810, 320, 25),
  createLeaf('leaf-ul-4', 920, 385, 855, 365, 24),

  // ── Upper Right Quadrant ──
  createLeaf('leaf-ur-1', 1100, 285, 1155, 235, 24),
  createLeaf('leaf-ur-2', 1075, 315, 1130, 275, 26),
  createLeaf('leaf-ur-3', 1050, 345, 1110, 320, 25),
  createLeaf('leaf-ur-4', 1000, 385, 1065, 365, 24),

  // ── Middle Left Canopy ──
  createLeaf('leaf-ml-1', 700, 365, 640, 315, 24),
  createLeaf('leaf-ml-2', 725, 395, 665, 360, 26),
  createLeaf('leaf-ml-3', 755, 435, 690, 410, 28),
  createLeaf('leaf-ml-4', 815, 485, 745, 455, 26),

  // ── Middle Right Canopy ──
  createLeaf('leaf-mr-1', 1220, 365, 1280, 315, 24),
  createLeaf('leaf-mr-2', 1195, 395, 1255, 360, 26),
  createLeaf('leaf-mr-3', 1165, 435, 1230, 410, 28),
  createLeaf('leaf-mr-4', 1105, 485, 1175, 455, 26),

  // ── Lower Left Branch ──
  createLeaf('leaf-ll-1', 650, 420, 595, 380, 22),
  createLeaf('leaf-ll-2', 675, 455, 615, 430, 26),
  createLeaf('leaf-ll-3', 710, 495, 645, 475, 28),
  createLeaf('leaf-ll-4', 770, 545, 700, 525, 28),
  createLeaf('leaf-ll-5', 830, 575, 765, 570, 25),

  // ── Lower Right Branch ──
  createLeaf('leaf-lr-1', 1270, 420, 1325, 380, 22),
  createLeaf('leaf-lr-2', 1245, 455, 1305, 430, 26),
  createLeaf('leaf-lr-3', 1210, 495, 1275, 475, 28),
  createLeaf('leaf-lr-4', 1150, 545, 1220, 525, 28),
  createLeaf('leaf-lr-5', 1090, 575, 1155, 570, 25),

  // ── Inner Trunk / Foliage Fillers ──
  createLeaf('leaf-in-1', 940, 480, 885, 460, 22),
  createLeaf('leaf-in-2', 980, 480, 1035, 460, 22),
  createLeaf('leaf-in-3', 935, 560, 880, 540, 24),
  createLeaf('leaf-in-4', 985, 560, 1040, 540, 24),
  createLeaf('leaf-in-5', 945, 640, 890, 620, 22),
  createLeaf('leaf-in-6', 975, 640, 1030, 620, 22),
]

/** Clusters of small round tea berries/buds at branch nodes */
export const PLANT_BERRIES: BerryCluster[] = [
  // Central node cluster
  { id: 'b1', cx: 948, cy: 472, r: 6.5 },
  { id: 'b2', cx: 957, cy: 478, r: 5.5 },
  { id: 'b3', cx: 972, cy: 472, r: 6.5 },
  { id: 'b4', cx: 963, cy: 478, r: 5.5 },

  // Left mid node cluster
  { id: 'b5', cx: 885, cy: 535, r: 6 },
  { id: 'b6', cx: 893, cy: 542, r: 5 },
  { id: 'b7', cx: 878, cy: 544, r: 5.5 },

  // Right mid node cluster
  { id: 'b8', cx: 1035, cy: 535, r: 6 },
  { id: 'b9', cx: 1027, cy: 542, r: 5 },
  { id: 'b10', cx: 1042, cy: 544, r: 5.5 },

  // Left upper node cluster
  { id: 'b11', cx: 825, cy: 435, r: 5.5 },
  { id: 'b12', cx: 832, cy: 442, r: 5 },

  // Right upper node cluster
  { id: 'b13', cx: 1095, cy: 435, r: 5.5 },
  { id: 'b14', cx: 1088, cy: 442, r: 5 },
]
