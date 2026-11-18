import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { defaultLensConfig, type LensConfig } from './presets';
import { supportsHtmlInCanvas, supportsWebGL2, type CaptureInfo, type LensLayerHandle } from './shared';
import { GlLensLayer } from './webgl/GlLensLayer';
import { HtmlCanvasStageLayer } from './webgl/HtmlCanvasStageLayer';

export type LensPoint = { x: number; y: number };
/** Pixels, or a percentage of the stage size (`'50%'`). */
export type LensCoordinate = number | `${number}%`;
export type LensMode = 'drag' | 'follow' | 'static';
/** How the content reaches the GPU. */
export type LensCapture = 'snapshot' | 'html-in-canvas' | 'auto';

export interface LensStageProps extends Partial<LensConfig> {
  /** Content under the lens. Rendered once; the lens refracts a WebGL capture of it. */
  children: ReactNode;
  /**
   * `'snapshot'` (default): clone the DOM into a texture when it changes — works everywhere.
   * `'html-in-canvas'`: the stage becomes a `<canvas content="drawable">` (WICG) and
   * the browser streams the live content to the GPU every frame; falls back to snapshot
   * where the API is missing. `'auto'` is the same as `'html-in-canvas'`.
   */
  capture?: LensCapture;
  /** Whole config object (e.g. a preset). Individual props override it. */
  config?: Partial<LensConfig>;
  /** Show / hide the lens with a spring animation. Default `true`. */
  open?: boolean;
  /** `drag` (default): grab and move. `follow`: tracks the pointer. `static`: only `position`. */
  mode?: LensMode;
  /** Initial lens centre (uncontrolled). Default `{ x: '50%', y: '50%' }`. */
  defaultPosition?: { x: LensCoordinate; y: LensCoordinate };
  /** Controlled lens centre in px relative to the stage. */
  position?: LensPoint;
  /** Fires while the user moves the lens (target position, before smoothing). */
  onPositionChange?: (p: LensPoint) => void;
  onDragStart?: (p: LensPoint) => void;
  onDragEnd?: (p: LensPoint) => void;
  /** 0 = lens sticks to the pointer, 0.9 = very floaty. Default `0.75`. */
  smoothing?: number;
  /** Keep gliding after a flick, with friction. Default `true`. */
  inertia?: boolean;
  /** Keep the lens centre inside the stage. Default `true`. */
  bounded?: boolean;
  /** Background behind the content (outside the stage / before capture). Auto-detected when omitted. */
  background?: string;
  /** Pointer press scale feedback. Default `1.04`. */
  pressScale?: number;
  /** Max device pixel ratio of the lens canvas. Default `2`. */
  maxPixelRatio?: number;
  /**
   * Content texture resolution multiplier (× devicePixelRatio).
   * `'auto'` (default) = clamp(1.5 × magnification, 1.5, 3).
   */
  quality?: number | 'auto';
  /** Wavelengths sampled for chromatic dispersion (3–24). Default `8`. */
  spectralSamples?: number;
  /** Recapture the content when the DOM changes. Default `true`. */
  autoRefresh?: boolean;
  /** Also recapture every N ms (for canvas/video/CSS animations). Default `0` (off). */
  refreshInterval?: number;
  /**
   * Snapshot mode: the max share (0.05–0.9) of main-thread time recaptures may use while the content keeps
   * changing, e.g. while dragging something under the lens. Lower = smoother page but a laggier lens. Default `0.3`.
   */
  captureBudget?: number;
  /**
   * Snapshot mode: `'fast'` (default) clones only the style properties that affect appearance — ~4× cheaper
   * captures, pixel-identical in practice. `'full'` clones every computed property (use it if some exotic CSS
   * is missing from the lens).
   */
  captureStyles?: 'fast' | 'full';
  /** Fires after every content capture. */
  onCapture?: (info: CaptureInfo) => void;
  /** WebGL2 unavailable or the capture failed. The lens is hidden; the content stays. */
  onError?: (error: unknown) => void;
  className?: string;
  style?: CSSProperties;
  lensClassName?: string;
  lensStyle?: CSSProperties;
  'aria-label'?: string;
}

export interface LensStageHandle {
  /** Move the lens centre (px, relative to the stage). */
  moveTo: (x: number, y: number, opts?: { immediate?: boolean }) => void;
  /** Current (animated) lens centre. */
  getPosition: () => LensPoint;
  /** Move the lens back to the stage centre. */
  center: (opts?: { immediate?: boolean }) => void;
  /** Recapture the content now. */
  refresh: () => void;
  /** Capture method actually in use. */
  readonly capture: 'snapshot' | 'html-in-canvas';
  /** Stage element. */
  readonly element: HTMLDivElement | null;
}

const resolveCoord = (c: LensCoordinate, total: number) =>
  typeof c === 'number' ? c : (parseFloat(c) / 100) * total;

export const LensStage = forwardRef<LensStageHandle, LensStageProps>(function LensStage(props, ref) {
  const {
    children,
    config,
    capture = 'snapshot',
    open = true,
    mode = 'drag',
    defaultPosition,
    position,
    onPositionChange,
    onDragStart,
    onDragEnd,
    smoothing = 0.75,
    inertia = true,
    bounded = true,
    background,
    pressScale = 1.04,
    maxPixelRatio = 2,
    quality = 'auto',
    spectralSamples = 8,
    autoRefresh = true,
    refreshInterval = 0,
    captureBudget = 0.3,
    captureStyles = 'fast',
    onCapture,
    onError,
    className,
    style,
    lensClassName,
    lensStyle,
    'aria-label': ariaLabel = 'Glass lens. Use the arrow keys to move it.',
  } = props;

  // ---- config resolution (defaults < config < individual props) ----------
  const cfg: LensConfig = { ...defaultLensConfig, ...config };
  (Object.keys(defaultLensConfig) as (keyof LensConfig)[]).forEach((k) => {
    if (props[k] !== undefined) cfg[k] = props[k] as number;
  });
  const radius = Math.max(8, cfg.radius);
  const size = Math.round(radius * 2);

  // ---- WebGL availability -------------------------------------------------
  const [failed, setFailed] = useState(false);
  const available = !failed && (typeof window === 'undefined' || supportsWebGL2());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const fail = useCallback((err: unknown) => {
    console.warn('[LensStage] WebGL lens unavailable; rendering content without it.', err);
    setFailed(true);
    onErrorRef.current?.(err);
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined' && !supportsWebGL2()) onErrorRef.current?.(new Error('WebGL2 unavailable'));
  }, []);

  // HTML-in-Canvas when asked for and available; snapshot otherwise (or if it throws).
  const [hicFailed, setHicFailed] = useState(false);
  const useHtmlCanvas = available && capture !== 'snapshot' && !hicFailed && supportsHtmlInCanvas();
  const onHicUnsupported = useCallback((err: unknown) => {
    console.warn('[LensStage] HTML-in-Canvas failed; falling back to snapshot capture.', err);
    setHicFailed(true);
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<LensLayerHandle>(null);

  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [pressed, setPressed] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  // Respect the OS "reduce motion" setting: no smoothing, no flick, no overshoot.
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Mutable animation state (no re-render per frame).
  const anim = useRef({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    init: false,
    raf: 0,
    last: 0,
    drag: null as null | { id: number; ox: number; oy: number },
    /** Recent drag targets, for the release velocity. */
    trail: [] as { t: number; x: number; y: number }[],
    vx: 0,
    vy: 0,
    momentum: false,
  });
  const effSmoothing = reducedMotion ? 0 : smoothing;
  const live = useRef({ size, smoothing: effSmoothing, bounded, stageSize, onPositionChange });
  live.current = { size, smoothing: effSmoothing, bounded, stageSize, onPositionChange };

  // ---- positioning --------------------------------------------------------
  const apply = useCallback(() => {
    const { x, y } = anim.current;
    const R = live.current.size / 2;
    if (lensRef.current) lensRef.current.style.transform = `translate3d(${x - R}px, ${y - R}px, 0)`;
    layerRef.current?.update(x, y);
  }, []);

  const clampPoint = useCallback((x: number, y: number): LensPoint => {
    const { bounded: b, stageSize: s } = live.current;
    if (!b || !s.w || !s.h) return { x, y };
    return { x: Math.min(s.w, Math.max(0, x)), y: Math.min(s.h, Math.max(0, y)) };
  }, []);

  const tick = useCallback(
    (now: number) => {
      const a = anim.current;
      const dt = a.last ? Math.min(64, now - a.last) : 16.7;
      a.last = now;
      if (a.momentum) {
        // Glide with friction; stop on the stage edges.
        const { bounded: b, stageSize: st } = live.current;
        let nx = a.tx + a.vx * dt;
        let ny = a.ty + a.vy * dt;
        if (b && st.w && st.h) {
          if (nx < 0 || nx > st.w) a.vx = 0;
          if (ny < 0 || ny > st.h) a.vy = 0;
          nx = Math.min(st.w, Math.max(0, nx));
          ny = Math.min(st.h, Math.max(0, ny));
        }
        a.tx = nx;
        a.ty = ny;
        const f = Math.pow(0.86, dt / 16.7);
        a.vx *= f;
        a.vy *= f;
        if (Math.hypot(a.vx, a.vy) < 0.01) {
          a.momentum = false;
          live.current.onPositionChange?.({ x: a.tx, y: a.ty });
        }
      }
      const s = Math.min(0.97, Math.max(0, live.current.smoothing));
      const k = s === 0 ? 1 : 1 - Math.pow(s, dt / 16.7);
      a.x += (a.tx - a.x) * k;
      a.y += (a.ty - a.y) * k;
      if (!a.momentum && Math.abs(a.tx - a.x) < 0.05 && Math.abs(a.ty - a.y) < 0.05) {
        a.x = a.tx;
        a.y = a.ty;
        a.raf = 0;
        a.last = 0;
        apply();
        return;
      }
      apply();
      a.raf = requestAnimationFrame(tick);
    },
    [apply],
  );

  const setTarget = useCallback(
    (x: number, y: number, immediate = false, notify = false) => {
      const a = anim.current;
      a.momentum = false;
      const p = clampPoint(x, y);
      a.tx = p.x;
      a.ty = p.y;
      if (notify) live.current.onPositionChange?.(p);
      if (immediate) {
        a.x = p.x;
        a.y = p.y;
        if (a.raf) cancelAnimationFrame(a.raf);
        a.raf = 0;
        a.last = 0;
        apply();
      } else if (!a.raf) {
        a.raf = requestAnimationFrame(tick);
      }
    },
    [apply, clampPoint, tick],
  );

  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []);

  // Stage size.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setStageSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initial position / keep inside stage on resize.
  useLayoutEffect(() => {
    if (!stageSize.w || !stageSize.h) return;
    const a = anim.current;
    if (!a.init) {
      a.init = true;
      const start = position ?? {
        x: resolveCoord(defaultPosition?.x ?? '50%', stageSize.w),
        y: resolveCoord(defaultPosition?.y ?? '50%', stageSize.h),
      };
      setTarget(start.x, start.y, true);
    } else {
      setTarget(a.tx, a.ty, true);
    }
  }, [stageSize.w, stageSize.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Controlled position.
  useEffect(() => {
    if (position && anim.current.init) setTarget(position.x, position.y);
  }, [position?.x, position?.y, setTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Size changed → re-apply transforms right away.
  useLayoutEffect(apply, [apply, size, available, useHtmlCanvas]);

  // ---- interaction --------------------------------------------------------
  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onLensPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== 'drag' || e.button !== 0) return;
    const p = localPoint(e);
    const a = anim.current;
    if (Math.hypot(p.x - a.x, p.y - a.y) > radius) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    a.momentum = false;
    a.drag = { id: e.pointerId, ox: p.x - a.tx, oy: p.y - a.ty };
    a.trail = [{ t: performance.now(), x: a.tx, y: a.ty }];
    setPressed(true);
    onDragStart?.({ x: a.tx, y: a.ty });
  };

  const onLensPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = anim.current.drag;
    if (!d || d.id !== e.pointerId) return;
    const p = localPoint(e);
    setTarget(p.x - d.ox, p.y - d.oy, false, true);
    const a = anim.current;
    const t = performance.now();
    a.trail.push({ t, x: a.tx, y: a.ty });
    while (a.trail.length > 2 && t - a.trail[0].t > 100) a.trail.shift();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = anim.current;
    if (!a.drag || a.drag.id !== e.pointerId) return;
    a.drag = null;
    setPressed(false);
    // Flick: release velocity from the last ~100 ms of movement.
    const first = a.trail[0];
    const last = a.trail[a.trail.length - 1];
    const dt = last && first ? last.t - first.t : 0;
    if (inertia && !reducedMotion && dt > 8 && performance.now() - last.t < 60) {
      const cap = 2; // px/ms
      a.vx = Math.max(-cap, Math.min(cap, (last.x - first.x) / dt));
      a.vy = Math.max(-cap, Math.min(cap, (last.y - first.y) / dt));
      if (Math.hypot(a.vx, a.vy) > 0.15) {
        a.momentum = true;
        if (!a.raf) a.raf = requestAnimationFrame(tick);
      }
    }
    a.trail = [];
    onDragEnd?.({ x: a.tx, y: a.ty });
  };

  useEffect(() => {
    if (mode !== 'follow') return;
    const el = stageRef.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const p = localPoint(e);
      setTarget(p.x, p.y, false, true);
    };
    el.addEventListener('pointermove', move);
    return () => el.removeEventListener('pointermove', move);
  }, [mode, setTarget]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (mode === 'static') return;
    const step = e.shiftKey ? 50 : 10;
    const a = anim.current;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setTarget(a.tx + m[0], a.ty + m[1], false, true);
  };

  useImperativeHandle(
    ref,
    () => ({
      moveTo: (x, y, opts) => setTarget(x, y, opts?.immediate),
      getPosition: () => ({ x: anim.current.x, y: anim.current.y }),
      center: (opts) => {
        const s = live.current.stageSize;
        setTarget(s.w / 2, s.h / 2, opts?.immediate);
      },
      refresh: () => layerRef.current?.refresh(),
      capture: useHtmlCanvas ? ('html-in-canvas' as const) : ('snapshot' as const),
      get element() {
        return stageRef.current;
      },
    }),
    [setTarget, useHtmlCanvas],
  );

  // ---- render -------------------------------------------------------------

  return (
    <div
      ref={stageRef}
      className={className}
      style={{ position: 'relative', isolation: 'isolate', ...style }}
      data-lens-stage=""
    >
      {useHtmlCanvas ? (
        <HtmlCanvasStageLayer
          ref={layerRef}
          cfg={cfg}
          radius={size / 2}
          open={open}
          pressed={pressed}
          pressScale={pressScale}
          stageRef={stageRef}
          lensRef={lensRef}
          stageSize={stageSize}
          background={background}
          maxPixelRatio={maxPixelRatio}
          quality={quality}
          spectralSamples={spectralSamples}
          reducedMotion={reducedMotion}
          onCapture={onCapture}
          onUnsupported={onHicUnsupported}
        >
          {children}
        </HtmlCanvasStageLayer>
      ) : (
        children
      )}

      {available && (
      <div
        ref={lensRef}
        role="slider"
        aria-label={ariaLabel}
        aria-valuetext={`x ${Math.round(anim.current.x)}, y ${Math.round(anim.current.y)}`}
        tabIndex={mode === 'static' || !open ? -1 : 0}
        onPointerDown={onLensPointerDown}
        onPointerMove={onLensPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onFocus={(e) => setFocusVisible(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setFocusVisible(false)}
        className={lensClassName}
        data-lens-ignore=""
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          zIndex: 10,
          touchAction: 'none',
          outline: 'none',
          borderRadius: '50%',
          boxShadow: focusVisible ? '0 0 0 3px var(--lens-focus-ring, rgba(80, 140, 255, 0.9))' : undefined,
          cursor: mode === 'drag' ? (pressed ? 'grabbing' : 'grab') : undefined,
          pointerEvents: mode === 'drag' && open ? 'auto' : 'none',
          willChange: 'transform',
          ...lensStyle,
        }}
      >
        {!useHtmlCanvas && (
        <GlLensLayer
          ref={layerRef}
          cfg={cfg}
          radius={size / 2}
          open={open}
          pressed={pressed}
          pressScale={pressScale}
          stageRef={stageRef}
          lensRef={lensRef}
          stageSize={stageSize}
          background={background}
          maxPixelRatio={maxPixelRatio}
          quality={quality}
          spectralSamples={spectralSamples}
          autoRefresh={autoRefresh}
          refreshInterval={refreshInterval}
          captureBudget={captureBudget}
          captureStyles={captureStyles}
          onCapture={onCapture}
          reducedMotion={reducedMotion}
          onFallback={fail}
        />
        )}
      </div>
      )}
    </div>
  );
});
