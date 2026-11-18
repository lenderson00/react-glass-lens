/**
 * Optics for the glass lens (shared by the WebGL shader and CPU-side helpers).
 *
 * The lens is modelled as a radially-symmetric piece of glass resting slightly
 * above the content. Its top surface follows a super-ellipse profile
 * (sphere → flat "puck" as `oblateness` grows) that only starts curving after
 * `bevelStart`. For every radius we trace a ray from the viewer straight down,
 * refract it into the glass (Snell), let it travel to the flat bottom, refract
 * it out again and let it travel `refraction × radius` more pixels to the
 * content. The landing point tells us which content pixel is visible there.
 *
 * Result is normalised so the very centre of the lens shows exactly
 * `magnification` and all the refraction lives on the rim — that is where the
 * warping, inversion and colour fringing appear.
 */

export interface LensOptics {
  /** Lens radius in CSS pixels. */
  radius: number;
  /** Index of refraction of the glass (1 = air, 1.33 = water, 1.52 = glass). */
  ior: number;
  /** Dispersion: IOR difference between red/blue channels. 0 disables chromatic aberration. */
  aberration: number;
  /** Height of the dome relative to the radius (1 = hemisphere). */
  thickness: number;
  /** 0–1: normalised radius where the surface starts to curve. Inside it the glass is flat. */
  bevelStart: number;
  /** 0–1: 0 = round sphere profile, 1 = flat puck with a steep edge. */
  oblateness: number;
  /** Gap between the glass bottom and the content, relative to the radius. Bigger = stronger rim warp. */
  refraction: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));


/** Super-ellipse exponent from oblateness: 2 (circle) … 12 (almost a box). */
export const profileExponent = (oblateness: number) => 2 + Math.pow(clamp(oblateness, 0, 1), 1.4) * 10;

/** Light direction (screen space, y down, z towards viewer) from an angle in degrees. */
export function lightVector(angleDeg: number): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  const v: [number, number, number] = [Math.sin(a) * 0.62, -Math.cos(a) * 0.62, 0.78];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** How much the bare optics magnify at the very centre; used to normalise so `magnification` is exact. */
export function centreGain(o: LensOptics) {
  const eps = 1e-3;
  return clamp(traceRadius(eps, Math.max(1.0001, o.ior), o, profileExponent(o.oblateness)) / eps, 0.05, 10);
}

/** Normalised surface height (0–1) at normalised radius r. */
function surfaceHeight(r: number, bevel: number, p: number) {
  if (r >= 1) return 0;
  if (r <= bevel) return 1;
  const t = (r - bevel) / (1 - bevel);
  return Math.pow(1 - Math.pow(t, p), 1 / p);
}

/** dh/dr, numerically. */
function surfaceSlope(r: number, bevel: number, p: number) {
  const e = 5e-4;
  const a = Math.max(0, r - e);
  const b = Math.min(0.99999, r + e);
  return (surfaceHeight(b, bevel, p) - surfaceHeight(a, bevel, p)) / (b - a);
}

/**
 * Trace the ray hitting the lens at normalised radius `r`.
 * Returns the normalised radius on the content where it lands
 * (negative = crossed the axis → inverted image).
 */
function traceRadius(r: number, ior: number, o: LensOptics, p: number) {
  const bevel = clamp(o.bevelStart, 0, 0.98);
  const h = surfaceHeight(r, bevel, p) * o.thickness;
  const m = surfaceSlope(r, bevel, p) * o.thickness;

  // Surface normal in (radial, z) – points outwards/up.
  let nx = -m;
  let nz = 1;
  const len = Math.hypot(nx, nz);
  nx /= len;
  nz /= len;

  // Incident ray (0, -1). Refract into glass.
  const eta = 1 / ior;
  const cosi = nz;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  const c = eta * cosi - Math.sqrt(Math.max(0, k));
  const tx = c * nx;
  const tz = -eta + c * nz;

  const insideGlass = (h * tx) / Math.max(1e-4, -tz);

  // Exit through the flat bottom into air (Snell again), clamp near TIR.
  const ex = clamp(tx * ior, -0.985, 0.985);
  const ez = Math.sqrt(1 - ex * ex);
  const throughGap = (o.refraction * ex) / ez;

  return r + insideGlass + throughGap;
}
