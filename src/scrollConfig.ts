/**
 * Shared ScrollTrigger configuration for the master narrative timeline.
 *
 * The scroll runway (#scroll-track) is 500vh  five 100vh sections, one per
 * scene. With `end: 'bottom bottom'` the timeline spans exactly that runway,
 * so 1 "timeline second" = 1 scene = 1 viewport-height of scroll: scene N
 * occupies [N-1, N] on the timeline.
 */
export const SCROLL_TRIGGER_DEFAULTS = {
  trigger: '#scroll-track',
  start: 'top top',
  end: 'bottom bottom',
  /** ~1s of smoothing between scrollbar and playhead  keeps line-drawing buttery. */
  scrub: 1,
} as const

export const SCENE_COUNT = 5
