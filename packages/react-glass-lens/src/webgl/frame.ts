import { useRef, type MutableRefObject } from 'react';
import { centreGain, lightVector, profileExponent } from '../optics';
import type { LensLayerProps } from '../shared';
import type { LensFrame } from './renderer';

export interface FrameInputs extends LensLayerProps {
  spectralSamples: number;
  reducedMotion: boolean;
}

export interface SpringState {
  open: number;
  openV: number;
  press: number;
  pressV: number;
  raf: number;
  last: number;
}

/** Half-size of the box the lens (plus press scale and shadow) can paint into, CSS px. */
export const lensBoxHalf = (radius: number, pressScale: number) =>
  radius * Math.max(1, pressScale) + Math.ceil(radius * 0.55);

/** Everything the shader needs for one frame. */
export function buildFrame(
  p: FrameInputs,
  s: SpringState,
  pos: { x: number; y: number },
  background: [number, number, number],
): LensFrame {
  const c = p.cfg;
  const half = lensBoxHalf(p.radius, p.pressScale);
  return {
    cssWidth: half * 2,
    cssHeight: half * 2,
    pixelRatio: Math.min(p.maxPixelRatio, window.devicePixelRatio || 1),
    stage: [p.stageSize.w, p.stageSize.h],
    center: [pos.x, pos.y],
    radius: p.radius * Math.max(0, s.open) * s.press,
    baseRadius: p.radius,
    magnification: c.magnification,
    ior: c.ior,
    dispersion: c.aberration,
    thickness: c.thickness,
    bevel: c.bevelStart,
    exponent: profileExponent(c.oblateness),
    gap: c.refraction,
    gain: centreGain({
      radius: p.radius,
      ior: c.ior,
      aberration: c.aberration,
      thickness: c.thickness,
      bevelStart: c.bevelStart,
      oblateness: c.oblateness,
      refraction: c.refraction,
    }),
    specular: c.specular,
    rim: c.rim,
    shade: c.shadow,
    shadow: Math.min(1, c.shadow),
    frost: c.frost ?? 0,
    light: lightVector(c.lightAngle),
    background,
    alpha: Math.min(1, Math.max(0, s.open * 3)),
    samples: c.aberration > 1e-5 ? Math.max(3, Math.min(24, Math.round(p.spectralSamples))) : 1,
  };
}

const SPRING_K = 320;
const SPRING_C = 22;

/**
 * Open / press springs. `ready` gates opening (e.g. until the first texture).
 * Returns the state and a `kick()` that starts the animation loop.
 */
export function useLensSprings(
  live: MutableRefObject<FrameInputs>,
  ready: MutableRefObject<boolean>,
  draw: () => void,
) {
  const springs = useRef<SpringState>({ open: 0, openV: 0, press: 1, pressV: 0, raf: 0, last: 0 });
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const animate = (now: number) => {
    const s = springs.current;
    const dt = Math.min(1 / 30, s.last ? (now - s.last) / 1000 : 1 / 60);
    s.last = now;
    const p = live.current;
    const openT = p.open && ready.current ? 1 : 0;
    const pressT = p.pressed ? p.pressScale : 1;
    const settle = () => {
      s.open = openT;
      s.press = pressT;
      s.openV = s.pressV = 0;
      s.raf = 0;
      s.last = 0;
    };
    if (p.reducedMotion) {
      settle();
      drawRef.current();
      return;
    }
    s.openV += (SPRING_K * (openT - s.open) - SPRING_C * s.openV) * dt;
    s.open += s.openV * dt;
    s.pressV += (SPRING_K * (pressT - s.press) - SPRING_C * s.pressV) * dt;
    s.press += s.pressV * dt;
    const settled =
      Math.abs(openT - s.open) < 1e-3 &&
      Math.abs(s.openV) < 1e-3 &&
      Math.abs(pressT - s.press) < 1e-4 &&
      Math.abs(s.pressV) < 1e-3;
    if (settled) settle();
    else s.raf = requestAnimationFrame(animate);
    drawRef.current();
  };

  const kick = () => {
    const s = springs.current;
    if (!s.raf) s.raf = requestAnimationFrame(animate);
  };
  const stop = () => {
    cancelAnimationFrame(springs.current.raf);
    springs.current.raf = 0;
  };

  return { springs, kick, stop };
}
