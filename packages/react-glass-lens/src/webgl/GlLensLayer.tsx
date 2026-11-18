import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  detectBackground,
  observeTheme,
  parseRgb,
  type CaptureInfo,
  type LensLayerHandle,
  type LensLayerProps,
} from '../shared';
import { StageCapture } from './capture';
import { buildFrame, lensBoxHalf, useLensSprings } from './frame';
import { LensRenderer } from './renderer';

export interface GlLensLayerProps extends LensLayerProps {
  spectralSamples: number;
  autoRefresh: boolean;
  refreshInterval: number;
  onCapture?: (info: CaptureInfo) => void;
  /** Skip spring overshoot (prefers-reduced-motion). */
  reducedMotion: boolean;
  /** WebGL or capture failed → parent hides the lens. */
  onFallback: (err: unknown) => void;
}

export const GlLensLayer = forwardRef<LensLayerHandle, GlLensLayerProps>(function GlLensLayer(props, ref) {
  const { radius, pressScale, stageRef, lensRef, stageSize } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LensRenderer | null>(null);
  const captureRef = useRef<StageCapture | null>(null);
  const lastFrame = useRef<HTMLCanvasElement | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const bg = useRef<{ css: string; rgb: [number, number, number] }>({ css: '#fff', rgb: [1, 1, 1] });
  const [texReady, setTexReady] = useState(false);
  // Bumped when the device pixel ratio changes (window moved to another screen).
  const [, setDprTick] = useState(0);

  const live = useRef(props);
  live.current = props;
  const liveTex = useRef(texReady);
  liveTex.current = texReady;

  // Canvas is larger than the lens so the shadow and press-scale fit.
  const half = lensBoxHalf(radius, pressScale);

  // ---- drawing ------------------------------------------------------------
  const draw = () => {
    const r = rendererRef.current;
    if (!r) return;
    r.render(buildFrame(live.current, springs.current, pos.current, bg.current.rgb));
  };
  const { springs, kick, stop } = useLensSprings(live, liveTex, draw);

  // ---- setup --------------------------------------------------------------
  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    // Ancestor refs aren't attached yet during a child's first layout effect.
    const stage = (stageRef.current ?? canvas.closest('[data-lens-stage]')) as HTMLElement | null;
    if (!stage) return;
    let renderer: LensRenderer;
    try {
      renderer = new LensRenderer(canvas);
    } catch (err) {
      live.current.onFallback(err);
      return;
    }
    rendererRef.current = renderer;

    const capture = new StageCapture(stage, {
      ignore: (n) =>
        n === lensRef.current || (n instanceof Element && n.hasAttribute('data-lens-ignore')),
      onFrame: (frame, info) => {
        lastFrame.current = frame;
        rendererRef.current?.upload(frame);
        setTexReady(true);
        live.current.onCapture?.({ ...info, method: 'snapshot' });
        draw();
      },
      onError: (err) => live.current.onFallback(err),
    });
    captureRef.current = capture;

    const onLost = (e: Event) => {
      e.preventDefault();
      rendererRef.current = null;
    };
    const onRestored = () => {
      try {
        rendererRef.current = new LensRenderer(canvas);
        if (lastFrame.current) rendererRef.current.upload(lastFrame.current);
        draw();
      } catch (err) {
        live.current.onFallback(err);
      }
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      stop();
      capture.dispose();
      renderer.dispose();
      rendererRef.current = null;
      captureRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background (theme aware) + capture resolution, re-evaluated every render
  // (cheap). Resolution changes are debounced: rebuilding the capture context
  // on every slider tick would recapture the whole stage over and over.
  const scaleTimer = useRef(0);
  const syncCapture = () => {
    const stageEl = stageRef.current ?? (canvasRef.current?.closest('[data-lens-stage]') as HTMLElement | null);
    const css = live.current.background ?? detectBackground(stageEl);
    const bgChanged = css !== bg.current.css;
    if (bgChanged) bg.current = { css, rgb: parseRgb(css) };
    const r = rendererRef.current;
    const p = live.current;
    const cap = captureRef.current;
    if (!r || !cap || !p.stageSize.w) return;
    const dpr = window.devicePixelRatio || 1;
    // Centre zoom × a little extra for the rim stretch; mipmaps handle the rest.
    const want = p.quality === 'auto' ? dpr * Math.min(2, Math.max(1, p.cfg.magnification * 1.2)) : dpr * p.quality;
    // Pixel budget (~8 MP ≈ 32 MB + mips) and GPU limits.
    const budget = Math.sqrt(8e6 / (p.stageSize.w * p.stageSize.h));
    const limit = Math.min(r.maxTextureSize, 8192) / Math.max(p.stageSize.w, p.stageSize.h);
    const scale = Math.max(0.5, Math.round(Math.min(want, budget, limit) * 2) / 2);
    window.clearTimeout(scaleTimer.current);
    if (bgChanged || !cap.configured) cap.configure(scale, css);
    else scaleTimer.current = window.setTimeout(() => captureRef.current?.configure(scale, bg.current.css), 250);
  };
  useLayoutEffect(() => {
    syncCapture();
    draw();
  });
  useEffect(() => () => window.clearTimeout(scaleTimer.current), []);
  useEffect(() => {
    if (props.background) return;
    return observeTheme(() => {
      syncCapture();
      draw();
      captureRef.current?.request();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.background]);

  // Recapture on size changes.
  useEffect(() => {
    captureRef.current?.request();
  }, [stageSize.w, stageSize.h]);

  // Auto refresh: DOM mutations, finished transitions/animations, fonts.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !props.autoRefresh) return;
    const request = () => captureRef.current?.request();
    const mo = new MutationObserver((records) => {
      const lens = lensRef.current;
      if (records.some((m) => !lens || !lens.contains(m.target))) request();
    });
    mo.observe(stage, { subtree: true, childList: true, attributes: true, characterData: true });
    const onEnd = (e: Event) => {
      if (!lensRef.current?.contains(e.target as Node)) request();
    };
    stage.addEventListener('transitionend', onEnd);
    stage.addEventListener('animationend', onEnd);
    document.fonts?.addEventListener?.('loadingdone', request);
    void document.fonts?.ready.then(request);
    return () => {
      mo.disconnect();
      stage.removeEventListener('transitionend', onEnd);
      stage.removeEventListener('animationend', onEnd);
      document.fonts?.removeEventListener?.('loadingdone', request);
    };
  }, [props.autoRefresh, stageRef, lensRef]);

  // Don't capture while the stage is off-screen or the tab is hidden.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let onScreen = true;
    const update = () => captureRef.current?.setPaused(!onScreen || document.hidden);
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      update();
    });
    io.observe(stage);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [stageRef]);

  // Device pixel ratio changes → re-render (new canvas size + capture scale).
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    const listen = () => {
      mq?.removeEventListener('change', onChange);
      mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener('change', onChange);
    };
    const onChange = () => {
      listen();
      setDprTick((t) => t + 1);
    };
    listen();
    return () => mq?.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!props.refreshInterval || props.refreshInterval <= 0) return;
    const id = setInterval(() => captureRef.current?.request(), props.refreshInterval);
    return () => clearInterval(id);
  }, [props.refreshInterval]);

  // Redraw on any prop change; springs on open/press/texture.
  useEffect(kick, [props.open, props.pressed, props.pressScale, texReady]);

  useImperativeHandle(ref, () => ({
    update: (x, y) => {
      pos.current = { x, y };
      draw();
    },
    refresh: () => captureRef.current?.request(),
  }));

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-lens-renderer="webgl"
      style={{
        position: 'absolute',
        left: radius - half,
        top: radius - half,
        width: half * 2,
        height: half * 2,
        pointerEvents: 'none',
      }}
    />
  );
});
