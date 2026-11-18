import { createContext, destroyContext, domToCanvas, type Context } from 'modern-screenshot';
import type { CaptureInfo } from '../shared';

export interface StageCaptureOptions {
  /** Nodes to leave out of the snapshot (the lens itself, overlays…). */
  ignore: (node: Node) => boolean;
  onFrame: (canvas: HTMLCanvasElement, info: Omit<CaptureInfo, 'method'>) => void;
  onError: (err: unknown) => void;
}

/**
 * The style properties that affect how a node *looks*. Cloning only these
 * (instead of every computed property) makes a capture ~4× cheaper with
 * pixel-identical results — `transition`, `animation`, `cursor`, `pointer-events`
 * and friends don't matter in a static snapshot. Use `captureStyles: 'full'`
 * if an exotic property is missing.
 */
export const VISUAL_STYLE_PROPERTIES = [
  'accent-color',
  'align-content',
  'align-items',
  'align-self',
  'appearance',
  'aspect-ratio',
  'backdrop-filter',
  'backface-visibility',
  'background-attachment',
  'background-blend-mode',
  'background-clip',
  'background-color',
  'background-image',
  'background-origin',
  'background-position',
  'background-repeat',
  'background-size',
  'border-bottom-color',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-bottom-style',
  'border-bottom-width',
  'border-collapse',
  'border-image-outset',
  'border-image-repeat',
  'border-image-slice',
  'border-image-source',
  'border-image-width',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-spacing',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-top-style',
  'border-top-width',
  'bottom',
  'box-shadow',
  'box-sizing',
  'caption-side',
  'clear',
  'clip-path',
  'color',
  'color-scheme',
  'column-count',
  'column-gap',
  'column-rule',
  'contain',
  'content',
  'content-visibility',
  'direction',
  'display',
  'empty-cells',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'flex-basis',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'float',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'font-optical-sizing',
  'font-size',
  'font-stretch',
  'font-style',
  'font-synthesis',
  'font-variant',
  'font-variant-caps',
  'font-variant-east-asian',
  'font-variant-ligatures',
  'font-variant-numeric',
  'font-variation-settings',
  'font-weight',
  'gap',
  'grid-auto-columns',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-column-end',
  'grid-column-start',
  'grid-row-end',
  'grid-row-start',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'hyphens',
  'image-rendering',
  'inset',
  'isolation',
  'justify-content',
  'justify-items',
  'justify-self',
  'left',
  'letter-spacing',
  'line-break',
  'line-height',
  'list-style-image',
  'list-style-position',
  'list-style-type',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'mask-clip',
  'mask-composite',
  'mask-image',
  'mask-mode',
  'mask-origin',
  'mask-position',
  'mask-repeat',
  'mask-size',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'mix-blend-mode',
  'object-fit',
  'object-position',
  'opacity',
  'order',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'overflow-wrap',
  'overflow-x',
  'overflow-y',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'paint-order',
  'perspective',
  'position',
  'quotes',
  'resize',
  'right',
  'row-gap',
  'shape-rendering',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'tab-size',
  'table-layout',
  'text-align',
  'text-decoration-color',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-thickness',
  'text-emphasis-color',
  'text-emphasis-style',
  'text-indent',
  'text-justify',
  'text-orientation',
  'text-overflow',
  'text-rendering',
  'text-shadow',
  'text-transform',
  'text-underline-offset',
  'text-wrap',
  'top',
  'transform',
  'transform-origin',
  'transform-style',
  'unicode-bidi',
  'vertical-align',
  'visibility',
  'white-space',
  'width',
  'word-break',
  'word-spacing',
  'writing-mode',
  'z-index',
  '-webkit-background-clip',
  '-webkit-mask-image',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  '-webkit-text-stroke-width',
];

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Snapshots a DOM element into a canvas (SVG foreignObject under the hood).
 * Requests are coalesced: while a capture runs, any number of new requests
 * collapse into a single follow-up capture, so the texture is never more than
 * one capture behind the DOM.
 */
export class StageCapture {
  private ctx: Context<HTMLElement> | null = null;
  private ctxKey = '';
  private busy = false;
  private dirty = false;
  private disposed = false;
  private paused = false;
  private failures = 0;
  private scale = 1;
  private background = '#fff';
  private el: HTMLElement;
  private opts: StageCaptureOptions;
  /**
   * Max share of main-thread time captures may take while the content keeps
   * changing (0.05–0.9). After a capture that took `ms`, the next one waits
   * `ms × (1 − budget) / budget`. Lower = smoother page, laggier lens.
   */
  budget = 0.3;
  /** `'fast'` clones only visual style properties; `'full'` clones all of them. */
  private styles: 'fast' | 'full' = 'fast';

  setStyles(styles: 'fast' | 'full') {
    if (styles === this.styles) return;
    this.styles = styles;
    this.request();
  }

  constructor(el: HTMLElement, opts: StageCaptureOptions) {
    this.el = el;
    this.opts = opts;
  }

  /** Whether `configure` was called at least once. */
  configured = false;

  configure(scale: number, background: string) {
    const first = !this.configured;
    this.configured = true;
    if (!first && scale === this.scale && background === this.background) return;
    this.scale = scale;
    this.background = background;
    this.request();
  }

  request() {
    if (this.disposed) return;
    this.dirty = true;
    if (!this.busy && !this.paused) void this.loop();
  }

  /** Skip captures while the stage is hidden/off-screen; catch up once visible. */
  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (!paused && this.dirty && !this.busy) void this.loop();
  }

  private async ensureContext() {
    const key = `${this.scale}|${this.background}|${this.styles}|${this.el.clientWidth}x${this.el.clientHeight}`;
    if (this.ctx && key === this.ctxKey) return this.ctx;
    if (this.ctx) destroyContext(this.ctx);
    this.ctxKey = key;
    this.ctx = await createContext(this.el, {
      scale: this.scale,
      backgroundColor: this.background,
      width: this.el.clientWidth,
      height: this.el.clientHeight,
      filter: (n) => !this.opts.ignore(n),
      includeStyleProperties: this.styles === 'fast' ? VISUAL_STYLE_PROPERTIES : null,
      timeout: 15000,
      autoDestruct: false,
    });
    return this.ctx;
  }

  private async loop() {
    this.busy = true;
    try {
      while (this.dirty && !this.disposed && !this.paused) {
        this.dirty = false;
        const t0 = performance.now();
        const ctx = await this.ensureContext();
        const canvas = await domToCanvas(ctx);
        if (this.disposed) break;
        const ms = performance.now() - t0;
        this.failures = 0;
        this.opts.onFrame(canvas, { ms, width: canvas.width, height: canvas.height });
        // Cloning the DOM runs on the main thread; during bursts of changes keep
        // capture to roughly half of the time so page interaction stays fluid.
        if (this.dirty) {
          const b = Math.min(0.9, Math.max(0.05, this.budget));
          await sleep(Math.max(16, (ms * (1 - b)) / b));
        }
        await nextFrame();
      }
    } catch (err) {
      // Transient failures (a font/image fetch, a resize mid-capture) get a
      // couple of retries with a fresh context before we give up.
      this.failures++;
      if (this.ctx) destroyContext(this.ctx);
      this.ctx = null;
      if (this.failures <= 2 && !this.disposed) {
        setTimeout(() => this.request(), 400 * this.failures);
        return;
      }
      this.opts.onError(err);
    } finally {
      this.busy = false;
    }
  }

  dispose() {
    this.disposed = true;
    if (this.ctx) destroyContext(this.ctx);
    this.ctx = null;
  }
}
