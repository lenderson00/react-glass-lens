import type { RefObject } from 'react';
import type { LensConfig } from './presets';

export interface CaptureInfo {
  /** Time the DOM → texture capture took, in ms. */
  ms: number;
  width: number;
  height: number;
  /** How the content reached the GPU. */
  method: 'snapshot' | 'html-in-canvas';
}

/** Imperative API of the lens layer. */
export interface LensLayerHandle {
  /** Lens centre moved (stage px). Called inside requestAnimationFrame. */
  update: (x: number, y: number) => void;
  /** Recapture the content under the lens. */
  refresh: () => void;
}

export interface LensLayerProps {
  cfg: LensConfig;
  radius: number;
  open: boolean;
  pressed: boolean;
  pressScale: number;
  stageRef: RefObject<HTMLDivElement | null>;
  /** Positioner element (excluded from captures / mutations). */
  lensRef: RefObject<HTMLDivElement | null>;
  stageSize: { w: number; h: number };
  background?: string;
  maxPixelRatio: number;
  quality: number | 'auto';
}

const isTransparent = (c: string) =>
  !c || c === 'transparent' || /rgba?\([^)]*,\s*0\s*\)$/.test(c) || /\/\s*0\s*\)$/.test(c);

/** First non-transparent background colour walking up from `el`. */
export function detectBackground(el: HTMLElement | null) {
  let node: HTMLElement | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (!isTransparent(bg)) return bg;
    node = node.parentElement;
  }
  return '#ffffff';
}

/** Parse a computed `rgb()/rgba()` colour into 0–1 floats. */
export function parseRgb(c: string): [number, number, number] {
  const m = c.match(/[\d.]+/g);
  if (!m || m.length < 3) return [1, 1, 1];
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255];
}

/** Call `cb` whenever the page theme may have changed (class/style/data-theme or color-scheme). */
export function observeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  const opts = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] };
  mo.observe(document.documentElement, opts);
  mo.observe(document.body, opts);
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', cb);
  };
}

let webgl2Support: boolean | null = null;
export function supportsWebGL2() {
  if (webgl2Support !== null) return webgl2Support;
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl2Support = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Support = false;
  }
  return webgl2Support;
}

/**
 * HTML-in-Canvas (WICG): `content="drawable"` canvas, `drawable` descendants,
 * `requestPaint()` / `paint` event, and `texElementSubImage2D()` on WebGL.
 */
export function supportsHtmlInCanvas() {
  if (typeof window === 'undefined' || typeof WebGL2RenderingContext === 'undefined') return false;
  const gl = WebGL2RenderingContext.prototype as unknown as Record<string, unknown>;
  const canvas = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const hasTextureUpload =
    typeof gl.texElementSubImage2D === 'function' || typeof gl.texElementImage2D === 'function';
  const hasPaintLoop =
    typeof canvas.requestPaint === 'function' &&
    (typeof canvas.getElementImageDefaultSize === 'function' ||
      typeof canvas.updateElementGeometry === 'function');
  return hasTextureUpload && hasPaintLoop;
}
