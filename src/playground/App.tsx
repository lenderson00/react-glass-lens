import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  LensStage,
  defaultLensConfig,
  lensPresets,
  type CaptureInfo,
  type LensCapture,
  type LensConfig,
  type LensMode,
  type LensPresetName,
  type LensStageHandle,
} from 'react-glass-lens';
import { useViewportStage } from '../lib/useViewportStage';
import { ControlPanel } from './ControlPanel';
import { Scene, initialStickers, type StickerState } from './Scene';

interface CodeExtras {
  open: boolean;
  mode: LensMode;
  smoothing: number;
  inertia: boolean;
  spectralSamples: number;
  quality: number | null;
  capture: LensCapture;
  captureBudget: number;
}

// ---- playground settings persistence -------------------------------------
const STORE_KEY = 'lens-playground-v1';

interface Settings extends CodeExtras {
  config: LensConfig;
  preset: LensPresetName | 'custom';
}

const DEFAULT_SETTINGS: Settings = {
  config: defaultLensConfig,
  preset: 'crystal',
  open: true,
  mode: 'drag',
  smoothing: 0.75,
  inertia: true,
  spectralSamples: 8,
  quality: null,
  capture: 'auto',
  captureBudget: 0.3,
};

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as Partial<Settings> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
    const config = { ...defaultLensConfig };
    for (const k of Object.keys(defaultLensConfig) as (keyof LensConfig)[]) {
      const v = raw.config?.[k];
      if (typeof v === 'number' && Number.isFinite(v)) config[k] = v;
    }
    return {
      config,
      preset: raw.preset === 'custom' || (raw.preset && raw.preset in lensPresets) ? raw.preset : 'crystal',
      open: typeof raw.open === 'boolean' ? raw.open : true,
      mode: raw.mode === 'follow' || raw.mode === 'static' ? raw.mode : 'drag',
      smoothing: typeof raw.smoothing === 'number' ? raw.smoothing : 0.75,
      inertia: typeof raw.inertia === 'boolean' ? raw.inertia : true,
      spectralSamples: typeof raw.spectralSamples === 'number' ? raw.spectralSamples : 8,
      quality: typeof raw.quality === 'number' ? raw.quality : null,
      capture: raw.capture === 'snapshot' || raw.capture === 'html-in-canvas' ? raw.capture : 'auto',
      captureBudget: typeof raw.captureBudget === 'number' ? raw.captureBudget : 0.3,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function buildCode(
  config: LensConfig,
  { open, mode, smoothing, inertia, spectralSamples, quality, capture, captureBudget }: CodeExtras,
) {
  const fmt = (v: number) => String(Math.round(v * 1000) / 1000);
  const lines = (Object.keys(defaultLensConfig) as (keyof LensConfig)[])
    .filter((k) => Math.abs(config[k] - defaultLensConfig[k]) > 1e-9)
    .map((k) => `  ${k}={${fmt(config[k])}}`);
  if (!open) lines.push('  open={false}');
  if (mode !== 'drag') lines.push(`  mode="${mode}"`);
  if (Math.abs(smoothing - 0.75) > 1e-9) lines.push(`  smoothing={${fmt(smoothing)}}`);
  if (!inertia) lines.push('  inertia={false}');
  if (spectralSamples !== 8) lines.push(`  spectralSamples={${spectralSamples}}`);
  if (quality !== null) lines.push(`  quality={${fmt(quality)}}`);
  if (capture !== 'snapshot') lines.push(`  capture="${capture}"`);
  if (Math.abs(captureBudget - 0.3) > 1e-9) lines.push(`  captureBudget={${fmt(captureBudget)}}`);
  const props = lines.length ? `\n${lines.join('\n')}\n` : '';
  return `import { LensStage } from 'react-glass-lens';

<LensStage${props}>
  <YourContent />
</LensStage>`;
}

export function Playground() {
  const [saved] = useState(loadSettings);
  const [config, setConfig] = useState<LensConfig>(saved.config);
  const [preset, setPreset] = useState<LensPresetName | 'custom'>(saved.preset);
  const [open, setOpen] = useState(saved.open);
  const [mode, setMode] = useState<LensMode>(saved.mode);
  const [smoothing, setSmoothing] = useState(saved.smoothing);
  const [inertia, setInertia] = useState(saved.inertia);
  const [lensError, setLensError] = useState(false);
  const [spectralSamples, setSpectralSamples] = useState(saved.spectralSamples);
  const [quality, setQuality] = useState<number | null>(saved.quality);
  const [capture, setCaptureMode] = useState<LensCapture>(saved.capture);
  const [captureBudget, setCaptureBudget] = useState(saved.captureBudget);
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo | null>(null);
  const [stickers, setStickers] = useState<StickerState[]>(initialStickers);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const lens = useRef<LensStageHandle>(null);
  const stickersRef = useRef(stickers);
  stickersRef.current = stickers;
  const { radius: viewportRadius, stickerScale } = useViewportStage(config.radius);
  const lensRadius = Math.min(config.radius, viewportRadius);

  const configRef = useRef(config);
  configRef.current = config;
  const onChange = useCallback((patch: Partial<LensConfig>) => {
    const next = { ...configRef.current, ...patch };
    configRef.current = next;
    // Show the preset name again when the values land back on one.
    const match = (Object.keys(lensPresets) as LensPresetName[]).find((name) =>
      (Object.keys(next) as (keyof LensConfig)[]).every((k) => Math.abs(next[k] - lensPresets[name][k]) < 1e-9),
    );
    setConfig(next);
    setPreset(match ?? 'custom');
  }, []);

  // Sticker dragging.
  const onStickerPointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const current = stickersRef.current.find((s) => s.id === id)!;
    const origin = { x: current.x, y: current.y };
    setStickers((list) => {
      const top = Math.max(...list.map((s) => s.z)) + 1;
      return list.map((s) => (s.id === id ? { ...s, z: top } : s));
    });
    setDraggingId(id);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setStickers((list) => list.map((s) => (s.id === id ? { ...s, x: origin.x + dx, y: origin.y + dy } : s)));
    };
    const up = () => {
      setDraggingId(null);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }, []);

  const code = useMemo(
    () => buildCode(config, { open, mode, smoothing, inertia, spectralSamples, quality, capture, captureBudget }),
    [config, open, mode, smoothing, inertia, spectralSamples, quality, capture, captureBudget],
  );

  // Keep tweaks across reloads.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const data: Settings = {
          config,
          preset,
          open,
          mode,
          smoothing,
          inertia,
          spectralSamples,
          quality,
          capture,
          captureBudget,
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch {
        /* storage unavailable */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [config, preset, open, mode, smoothing, inertia, spectralSamples, quality, capture, captureBudget]);

  return (
    <div className="app playground">
      <LensStage
        ref={lens}
        className="stage"
        config={config}
        radius={lensRadius}
        open={open}
        mode={mode}
        smoothing={smoothing}
        inertia={inertia}
        spectralSamples={spectralSamples}
        quality={quality ?? 'auto'}
        onCapture={setCaptureInfo}
        capture={capture}
        captureBudget={captureBudget}
        onError={() => setLensError(true)}
        defaultPosition={{ x: '50%', y: '50%' }}
      >
        <Scene
          stickers={stickers}
          draggingId={draggingId}
          onStickerPointerDown={onStickerPointerDown}
          layoutScale={stickerScale}
        />
      </LensStage>

      <ControlPanel
        config={config}
        onChange={onChange}
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        onModeChange={setMode}
        smoothing={smoothing}
        onSmoothingChange={setSmoothing}
        inertia={inertia}
        onInertiaChange={setInertia}
        preset={preset}
        onPreset={(p) => {
          setPreset(p);
          setConfig(lensPresets[p]);
        }}
        onReset={() => {
          setPreset('crystal');
          setConfig(defaultLensConfig);
          setStickers(initialStickers);
          setOpen(true);
          setMode('drag');
          setSmoothing(0.75);
          setInertia(true);
          setSpectralSamples(8);
          setQuality(null);
          setCaptureMode('auto');
          setCaptureBudget(0.3);
          lens.current?.center();
        }}
        onCenter={() => lens.current?.center()}
        code={code}
        lensError={lensError}
        spectralSamples={spectralSamples}
        onSpectralSamplesChange={setSpectralSamples}
        captureBudget={captureBudget}
        onCaptureBudgetChange={setCaptureBudget}
        quality={quality ?? 2}
        onQualityChange={setQuality}
        captureMs={captureInfo?.ms ?? null}
        textureSize={captureInfo ? `${captureInfo.width}×${captureInfo.height}` : null}
        capture={capture}
        onCaptureChange={setCaptureMode}
        captureMethod={captureInfo?.method ?? null}
      />

      <nav className="dock" aria-label="Mode">
        {(['drag', 'follow', 'static'] as const).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {{ drag: 'Drag', follow: 'Follow', static: 'Static' }[m]}
          </button>
        ))}
      </nav>
    </div>
  );
}
