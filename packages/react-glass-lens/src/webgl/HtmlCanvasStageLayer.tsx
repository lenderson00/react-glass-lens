import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { detectBackground, observeTheme, parseRgb, type CaptureInfo, type LensLayerHandle } from '../shared';
import { buildFrame, useLensSprings, type FrameInputs } from './frame';
import { LensRenderer } from './renderer';

/**
 * HTML-in-Canvas mode (WICG proposal): the stage itself is a
 * `<canvas content="drawable">` whose children are laid out and hit-tested as
 * usual, but painted by us. Every frame the browser hands the compositor's
 * snapshot of the content straight to a WebGL texture — no DOM cloning, no
 * main-thread capture — so the lens stays in sync with animations, video and
 * dragging at full frame rate.
 */
export interface HtmlCanvasStageLayerProps extends FrameInputs {
  children: ReactNode;
  onCapture?: (info: CaptureInfo) => void;
  /** API missing or it threw → parent falls back to snapshot capture. */
  onUnsupported: (err: unknown) => void;
}

type DrawableCanvas = HTMLCanvasElement & {
  requestPaint?: () => void;
  updateElementGeometry?: (el: Element, opts: { canvasTransform: DOMMatrixInit }) => void;
};

interface PaintEventLike extends Event {
  changedElements?: readonly Element[];
}

export const HtmlCanvasStageLayer = forwardRef<LensLayerHandle, HtmlCanvasStageLayerProps>(
  function HtmlCanvasStageLayer(props, ref) {
    const { stageSize, children } = props;
    const canvasRef = useRef<DrawableCanvas>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<LensRenderer | null>(null);
    const pos = useRef({ x: 0, y: 0 });
    const bg = useRef<{ css: string; rgb: [number, number, number] }>({ css: '#fff', rgb: [1, 1, 1] });
    const dirty = useRef(true);
    const lastReport = useRef(0);
    const [ready, setReady] = useState(false);

    const live = useRef<HtmlCanvasStageLayerProps>(props);
    live.current = props;
    const liveReady = useRef(ready);
    liveReady.current = ready;

    const draw = () => {
      const r = rendererRef.current;
      if (!r || !live.current.stageSize.w) return;
      r.renderStage(buildFrame(live.current, springs.current, pos.current, bg.current.rgb));
    };
    const { springs, kick, stop } = useLensSprings(live, liveReady, draw);

    // ---- setup + paint loop ----------------------------------------------
    useLayoutEffect(() => {
      const canvas = canvasRef.current!;
      const content = contentRef.current!;
      let renderer: LensRenderer;
      try {
        renderer = new LensRenderer(canvas);
      } catch (err) {
        live.current.onUnsupported(err);
        return;
      }
      rendererRef.current = renderer;

      let visible = true;
      let alive = true;
      const onPaint = (e: Event) => {
        const changed = (e as PaintEventLike).changedElements;
        if (dirty.current || !changed || changed.length > 0) {
          const t0 = performance.now();
          try {
            renderer.uploadElement(content, [0, 0]);
          } catch (err) {
            alive = false;
            live.current.onUnsupported(err);
            return;
          }
          dirty.current = false;
          // Keep hit testing aligned: the content is drawn 1:1 at the origin.
          canvas.updateElementGeometry?.(content, { canvasTransform: new DOMMatrix() });
          if (!liveReady.current) setReady(true);
          const now = performance.now();
          if (now - lastReport.current > 250) {
            lastReport.current = now;
            live.current.onCapture?.({
              ms: now - t0,
              width: canvas.width,
              height: canvas.height,
              method: 'html-in-canvas',
            });
          }
          draw();
        }
        if (alive && visible) canvas.requestPaint?.();
      };
      canvas.addEventListener('paint', onPaint);

      // Only keep the paint loop running while the stage is on screen.
      const io = new IntersectionObserver((entries) => {
        const was = visible;
        visible = entries.some((en) => en.isIntersecting);
        if (visible && !was) canvas.requestPaint?.();
      });
      io.observe(canvas);
      canvas.requestPaint?.();

      return () => {
        alive = false;
        io.disconnect();
        canvas.removeEventListener('paint', onPaint);
        stop();
        renderer.dispose();
        rendererRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Background colour (outside the stage / transparent content) + redraw.
    useLayoutEffect(() => {
      const css = live.current.background ?? detectBackground(canvasRef.current?.parentElement ?? null);
      if (css !== bg.current.css) bg.current = { css, rgb: parseRgb(css) };
      draw();
    });
    useEffect(() => {
      if (props.background) return;
      return observeTheme(() => {
        const css = detectBackground(canvasRef.current?.parentElement ?? null);
        bg.current = { css, rgb: parseRgb(css) };
        dirty.current = true;
        canvasRef.current?.requestPaint?.();
      });
    }, [props.background]);

    useEffect(() => {
      dirty.current = true;
      canvasRef.current?.requestPaint?.();
    }, [stageSize.w, stageSize.h]);

    useEffect(kick, [props.open, props.pressed, props.pressScale, ready]);

    useImperativeHandle(ref, () => ({
      update: (x, y) => {
        pos.current = { x, y };
        draw();
      },
      refresh: () => {
        dirty.current = true;
        canvasRef.current?.requestPaint?.();
      },
    }));

    // `content="drawable"` is the current attribute; `layoutsubtree` the earlier
    // one — both are set so either generation of the API picks it up.
    const canvasAttrs = { content: 'drawable', layoutsubtree: '' } as Record<string, string>;
    const drawableAttrs = { drawable: '' } as Record<string, string>;

    return (
      <canvas
        ref={canvasRef}
        {...canvasAttrs}
        data-lens-renderer="html-in-canvas"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      >
        <div {...drawableAttrs} style={{ width: stageSize.w || '100%', height: stageSize.h || '100%' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
        </div>
      </canvas>
    );
  },
);
