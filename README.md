# Elegantsip  The Journey of Tea

A scroll-driven, 100% 2D-vector brand homepage: React 19 + TypeScript + Vite,
inline SVG line art, GSAP ScrollTrigger + DrawSVGPlugin for the scrubbed
narrative, and Tailwind CSS v4 for layout. No WebGL, no 3D, no external
graphic assets  every visual is an inline SVG path.

Theme: white background, dark ink strokes (#2a3630), brand amber (#d48806).
Typography: **Google Sans Flex** (variable), loaded from Google Fonts in
[index.html](index.html) and wired as Tailwind's default via `--font-sans` in
[src/index.css](src/index.css).

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check (tsc --noEmit) + production build
npm run preview   # serve the production build
```

## The five chapters

The scroll runway is 500vh (5 × 100vh sections). Each viewport-height of
scroll is one "timeline second": scene N occupies `[N-1, N]` on the master
timeline (see [src/scrollConfig.ts](src/scrollConfig.ts)).

| Scene | Vector storytelling |
|---|---|
| 1 · Terrain | Mountain ridge lines draw on at load (mount intro); scroll drives layered parallax |
| 2 · Growth | Stems draw upward (DrawSVG), leaves `scale(0→1)` about their attachment points, veins trace on |
| 3 · Pluck | Close-up hero leaf; line-art hand gesture draws + slides in; glowing steam paths morph continuously |
| 4 · The Fall | Leaf tumbles 720° down the stage while GSAP interpolates `fill` #4CAF50 → #D48806; amber trails draw |
| 5 · Infusion | Cup outline draws itself; leaf plunges in at t=4.58; ripple rings radiate; clipped liquid tints to #9E4712 |

## Architecture notes

- **One master timeline** in
  [src/components/TeaVectorHomepage.tsx](src/components/TeaVectorHomepage.tsx),
  scrubbed via `ScrollTrigger`. Ambient motion (steam morph, intro draw) runs
  as mount-time tweens so it flows independent of scroll velocity.
- **Initial states via `gsap.set()`**, not `fromTo`  everything is authored
  in its final position and wound back at mount, which sidesteps every
  `immediateRender` surprise. The one deliberate `fromTo` (ripples) carries an
  `immediateRender: false` with a comment explaining why.
- **DrawSVGPlugin is free** since GSAP 3.13  imported from `gsap/DrawSVGPlugin`.
- **Steam morphs without MorphSVG**: base and alt `d` strings share identical
  command structures, so GSAP interpolates the raw attribute.
- **Gotcha, encoded in comments**: GSAP absorbs an element's authored SVG
  `transform="translate(x y)"` into its `x`/`y`  so positional tweens on the
  hero leaf use *absolute stage coordinates*, not offsets.
- Viewport: `viewBox="0 0 1920 1080"` + `preserveAspectRatio="xMidYMid slice"`
  → full-bleed scaling on any aspect ratio.
