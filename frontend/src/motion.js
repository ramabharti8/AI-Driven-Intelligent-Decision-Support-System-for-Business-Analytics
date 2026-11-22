// Respect the user's "reduce motion" system setting: no count-ups or chart animations.
export const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const ANIM = !REDUCED_MOTION
