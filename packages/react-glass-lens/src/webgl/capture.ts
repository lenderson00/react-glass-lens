import { createContext, destroyContext, domToCanvas, type Context } from 'modern-screenshot';
import type { CaptureInfo } from '../shared';

export interface StageCaptureOptions {
  /** Nodes to leave out of the snapshot (the lens itself, overlays…). */
  ignore: (node: Node) => boolean;
  onFrame: (canvas: HTMLCanvasElement, info: Omit<CaptureInfo, 'method'>) => void;
  onError: (err: unknown) => void;
}

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
  /** Idle time between back-to-back captures, as a multiple of the capture duration. */
  idleRatio = 1;

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
    const key = `${this.scale}|${this.background}|${this.el.clientWidth}x${this.el.clientHeight}`;
    if (this.ctx && key === this.ctxKey) return this.ctx;
    if (this.ctx) destroyContext(this.ctx);
    this.ctxKey = key;
    this.ctx = await createContext(this.el, {
      scale: this.scale,
      backgroundColor: this.background,
      width: this.el.clientWidth,
      height: this.el.clientHeight,
      filter: (n) => !this.opts.ignore(n),
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
        if (this.dirty) await sleep(Math.max(16, ms * this.idleRatio));
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
