import { useEffect, useState } from 'react';
import { isMobileViewport } from '../lib/viewport';

/** Frames per second and worst frame (ms) over the last half second. */
function useFps(active: boolean) {
  const [stats, setStats] = useState({ fps: 0, worst: 0 });
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let start = last;
    let frames = 0;
    let worst = 0;
    const tick = (now: number) => {
      frames++;
      worst = Math.max(worst, now - last);
      last = now;
      if (now - start >= 500) {
        setStats({ fps: Math.round((frames * 1000) / (now - start)), worst: Math.round(worst) });
        start = now;
        frames = 0;
        worst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return stats;
}
import {
  defaultLensConfig,
  supportsHtmlInCanvas,
  type LensCapture,
  type LensConfig,
  type LensMode,
  type LensPresetName,
} from 'react-glass-lens';

interface SliderProps {
  label: string;
  /** API prop name, shown in the tooltip. */
  name?: string;
  value: number;
  /** Double-click restores it; also drawn as a tick on the track. */
  defaultValue?: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  hint?: string;
  onChange: (v: number) => void;
}

function Slider({ label, name, value, defaultValue, min, max, step, digits = 2, hint, onChange }: SliderProps) {
  const toPct = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min))) * 100;
  const pct = toPct(value);
  const isDefault = defaultValue === undefined || Math.abs(value - defaultValue) < step / 2;
  const title = [name && `${name}`, hint, defaultValue !== undefined && 'Double-click: reset to default']
    .filter(Boolean)
    .join(' — ');
  return (
    <label
      className={`cp-row cp-slider${isDefault ? '' : ' is-changed'}`}
      title={title}
      onDoubleClick={defaultValue !== undefined ? () => onChange(defaultValue) : undefined}
    >
      <span className="cp-fill" style={{ width: `${pct}%` }} />
      {defaultValue !== undefined && <span className="cp-tick" style={{ left: `${toPct(defaultValue)}%` }} />}
      <span className="cp-label">{label}</span>
      <span className="cp-value">{value.toFixed(digits)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Segmented<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="cp-row cp-seg" role="radiogroup" aria-label={label}>
      <span className="cp-label">{label}</span>
      <div className="cp-seg-opts">
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type SliderDef = {
  key: keyof LensConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  digits?: number;
  hint: string;
};

const OPTICS: SliderDef[] = [
  { key: 'radius', label: 'Radius', min: 40, max: 320, step: 1, digits: 0, hint: 'Lens radius in px' },
  { key: 'magnification', label: 'Magnification', min: 0.5, max: 4, step: 0.01, hint: 'Zoom at the centre of the lens' },
  { key: 'ior', label: 'IOR', min: 1, max: 2.5, step: 0.001, digits: 3, hint: 'Index of refraction (1.33 water, 1.52 glass)' },
  { key: 'aberration', label: 'Aberration', min: 0, max: 0.1, step: 0.001, digits: 3, hint: 'Chromatic dispersion (colour fringes)' },
  { key: 'thickness', label: 'Thickness', min: 0.05, max: 1.5, step: 0.01, hint: 'Dome height (1 = hemisphere)' },
  { key: 'bevelStart', label: 'Bevel Start', min: 0, max: 0.95, step: 0.01, hint: 'Where the curvature starts (0 = whole dome)' },
  { key: 'oblateness', label: 'Oblateness', min: 0, max: 1, step: 0.01, hint: '0 = sphere, 1 = flat puck' },
  { key: 'refraction', label: 'Refraction', min: 0, max: 2, step: 0.01, hint: 'Glass → content gap; rim warp' },
  { key: 'frost', label: 'Frost', min: 0, max: 1, step: 0.01, hint: 'Frosted glass: blurs what is seen through it' },
];

const LIGHT: SliderDef[] = [
  { key: 'specular', label: 'Specular', min: 0, max: 2, step: 0.01, hint: 'Specular highlight' },
  { key: 'rim', label: 'Rim', min: 0, max: 2, step: 0.01, hint: 'Fresnel reflection on the rim' },
  { key: 'shadow', label: 'Shadow', min: 0, max: 1.5, step: 0.01, hint: 'Cast shadow and glass haze' },
  { key: 'lightAngle', label: 'Light Angle', min: -180, max: 180, step: 1, digits: 0, hint: 'Light direction (degrees)' },
];

export const PRESET_LABELS: Record<LensPresetName, string> = {
  crystal: 'Crystal',
  orb: 'Orb',
  magnifier: 'Magnifier',
  droplet: 'Droplet',
  subtle: 'Subtle',
  liquid: 'Liquid Glass',
};

interface ControlPanelProps {
  config: LensConfig;
  onChange: (patch: Partial<LensConfig>) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: LensMode;
  onModeChange: (m: LensMode) => void;
  smoothing: number;
  onSmoothingChange: (v: number) => void;
  inertia: boolean;
  onInertiaChange: (v: boolean) => void;
  preset: LensPresetName | 'custom';
  onPreset: (p: LensPresetName) => void;
  onReset: () => void;
  onCenter: () => void;
  code: string;
  lensError: boolean;
  spectralSamples: number;
  onSpectralSamplesChange: (v: number) => void;
  captureBudget: number;
  onCaptureBudgetChange: (v: number) => void;
  quality: number;
  onQualityChange: (v: number) => void;
  captureMs: number | null;
  textureSize: string | null;
  capture: LensCapture;
  onCaptureChange: (c: LensCapture) => void;
  captureMethod: 'snapshot' | 'html-in-canvas' | null;
}

export function ControlPanel(p: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(() => isMobileViewport());
  const [isMobile, setIsMobile] = useState(() => isMobileViewport());

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [tab, setTab] = useState<'optics' | 'light' | 'render' | 'code'>('optics');
  const [copied, setCopied] = useState(false);
  const perf = useFps(tab === 'render' && !collapsed);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <aside
      className={`cp${collapsed ? ' is-collapsed' : ''}${isMobile ? ' is-sheet' : ''}`}
      aria-label="Lens controls"
      aria-expanded={!collapsed}
    >
      <div className="cp-head">
        <span className="cp-title">Lens</span>
        <button
          type="button"
          className="cp-icon"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand controls' : 'Collapse controls'}
        >
          {collapsed ? '▴' : '▾'}
        </button>
      </div>
      {isMobile && collapsed && (
        <button type="button" className="cp-sheet-hint" onClick={() => setCollapsed(false)}>
          Tap to tune the lens
        </button>
      )}

      {!collapsed && (
        <>
          <div className="cp-toolbar">
            <select
              className="cp-select"
              value={p.preset}
              onChange={(e) => p.onPreset(e.target.value as LensPresetName)}
              aria-label="Preset"
            >
              {p.preset === 'custom' && <option value="custom">Custom</option>}
              {Object.entries(PRESET_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="cp-icon" onClick={p.onCenter} title="Centre the lens" aria-label="Centre the lens">
              ⊕
            </button>
            <button className="cp-icon" onClick={p.onReset} title="Reset to defaults" aria-label="Reset to defaults">
              ↺
            </button>
          </div>

          <Segmented
            label="Open"
            value={p.open}
            options={[
              { value: false, label: 'Off' },
              { value: true, label: 'On' },
            ]}
            onChange={p.onOpenChange}
          />

          <div className="cp-tabs" role="tablist">
            {(
              [
                ['optics', 'Optics'],
                ['light', 'Light'],
                ['render', 'Render'],
                ['code', 'Code'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'optics' &&
            OPTICS.map((d) => (
              <Slider
                key={d.key}
                label={d.label}
                name={d.key}
                value={p.config[d.key]}
                defaultValue={defaultLensConfig[d.key]}
                min={d.min}
                max={d.max}
                step={d.step}
                digits={d.digits}
                hint={d.hint}
                onChange={(v) => p.onChange({ [d.key]: v })}
              />
            ))}

          {tab === 'light' && (
            <>
              {LIGHT.map((d) => (
                <Slider
                  key={d.key}
                  label={d.label}
                  name={d.key}
                  value={p.config[d.key]}
                  defaultValue={defaultLensConfig[d.key]}
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  digits={d.digits}
                  hint={d.hint}
                  onChange={(v) => p.onChange({ [d.key]: v })}
                />
              ))}
            </>
          )}

          {tab === 'render' && (
            <>
              <Slider
                label="Spectral Samples"
                name="spectralSamples"
                value={p.spectralSamples}
                defaultValue={8}
                min={3}
                max={24}
                step={1}
                digits={0}
                hint="Wavelengths sampled for dispersion"
                onChange={p.onSpectralSamplesChange}
              />
              <Slider
                label="Capture Budget"
                name="captureBudget"
                value={p.captureBudget}
                defaultValue={0.3}
                min={0.1}
                max={0.9}
                step={0.05}
                hint="Share of main-thread time recaptures may use while content keeps changing. Lower = smoother page, laggier lens"
                onChange={p.onCaptureBudgetChange}
              />
              <Slider
                label="Quality"
                name="quality"
                value={p.quality}
                min={1}
                max={3}
                step={0.25}
                hint="Captured texture resolution (× DPR)"
                onChange={p.onQualityChange}
              />
              <Slider
                label="Smoothing"
                name="smoothing"
                value={p.smoothing}
                defaultValue={0.75}
                min={0}
                max={0.95}
                step={0.01}
                hint="Follow smoothing while dragging"
                onChange={p.onSmoothingChange}
              />
              <Segmented
                label="Capture"
                value={p.capture}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'snapshot', label: 'Snapshot' },
                  { value: 'html-in-canvas', label: 'HTML' },
                ]}
                onChange={p.onCaptureChange}
              />
              <Segmented
                label="Inertia"
                value={p.inertia}
                options={[
                  { value: false, label: 'Off' },
                  { value: true, label: 'On' },
                ]}
                onChange={p.onInertiaChange}
              />
              <Segmented
                label="Mode"
                value={p.mode}
                options={[
                  { value: 'drag', label: 'drag' },
                  { value: 'follow', label: 'follow' },
                  { value: 'static', label: 'static' },
                ]}
                onChange={p.onModeChange}
              />
              <div className="cp-stats">
                <span>
                  HTML-in-Canvas{' '}
                  <b>{supportsHtmlInCanvas() ? 'available' : 'not in this browser'}</b>
                </span>
                <span>
                  fps <b>{perf.fps}</b> · worst frame <b>{perf.worst} ms</b>
                </span>
                {p.lensError ? (
                  <span>
                    <b>WebGL2 unavailable</b> — lens hidden
                  </span>
                ) : p.captureMs !== null ? (
                  <span>
                    {p.captureMethod === 'html-in-canvas' ? 'html-in-canvas' : 'snapshot'}{' '}
                    <b>{Math.round(p.captureMs)} ms</b> · {p.textureSize}
                  </span>
                ) : (
                  <span>capturing…</span>
                )}
              </div>
            </>
          )}

          {tab === 'code' && (
            <div className="cp-code">
              <pre>{p.code}</pre>
              <button className="cp-copy" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy JSX'}
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
