/** Cap lens radius on small viewports (~38% of the shorter side). */
export function lensRadiusForViewport(
  requested: number,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1280,
  vh = typeof window !== 'undefined' ? window.innerHeight : 800,
) {
  const minDim = Math.min(vw, vh);
  const cap = Math.round(minDim * 0.38);
  return Math.min(requested, Math.max(88, cap));
}

/** Scale sticker layout spread on narrow screens. */
export function sceneStickerScale(vw = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  if (vw >= 900) return 1;
  if (vw >= 720) return 0.82;
  if (vw >= 480) return 0.62;
  return Math.max(0.4, vw / 820);
}

export function isMobileViewport(vw = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  return vw < 720;
}