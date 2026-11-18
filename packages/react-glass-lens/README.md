# react-glass-lens

Draggable WebGL2 glass lens for React. Per-pixel refraction over your DOM, chromatic dispersion, Fresnel rim, and optional live capture through the HTML-in-Canvas proposal.

**[Live demo](https://lenderson00.github.io/react-glass-lens/)**

![Lens drag over crystal, liquid, and orb presets](https://raw.githubusercontent.com/lenderson00/react-glass-lens/main/docs/assets/demo.gif)

## Install

```sh
npm i react-glass-lens
```

React 18 or 19 (peer dependency).

## Usage

```tsx
import { LensStage } from 'react-glass-lens';

export function Hero() {
  return (
    <LensStage style={{ height: 480 }}>
      <YourContent />
    </LensStage>
  );
}
```

`LensStage` is a `position: relative` wrapper. Size the stage, then tune props or a preset:

```tsx
import { LensStage, lensPresets } from 'react-glass-lens';

<LensStage config={lensPresets.magnifier} magnification={2.5} aberration={0.02}>
  <YourContent />
</LensStage>;
```

Precedence: built-in defaults, then `config`, then individual props.

## Presets

| Preset | Notes |
| --- | --- |
| `crystal` | Default: magnification, curved rim, dispersion |
| `orb` | Ball lens inversion near the edge |
| `magnifier` | Flat center, short edge |
| `droplet` | Water-like IOR |
| `subtle` | Low-strength refraction |
| `liquid` | UI glass (Liquid Glass inspired; no Apple affiliation) |

## Optics props (`LensConfig`)

| Prop | Default | Description |
| --- | --- | --- |
| `radius` | `258` | Lens radius in CSS px |
| `magnification` | `1.75` | Center zoom |
| `ior` | `1.52` | Index of refraction |
| `aberration` | `0.054` | Chromatic spread (`0` off) |
| `thickness` | `0.6` | Dome height / radius |
| `bevelStart` | `0.33` | Where curvature starts (0 to 1) |
| `oblateness` | `0.3` | 0 sphere, 1 flat puck |
| `refraction` | `0.3` | Glass to content gap / radius |
| `specular` | `0` | Specular highlight |
| `rim` | `0.2` | Fresnel on the edge |
| `shadow` | `0.45` | Cast shadow / haze |
| `lightAngle` | `-35` | Light direction (degrees) |
| `frost` | `0` | Frosted blur through the lens |

## Behavior and rendering

| Prop | Default | Description |
| --- | --- | --- |
| `config` | `n/a` | `Partial<LensConfig>` preset overlay |
| `capture` | `'snapshot'` | `snapshot`, `html-in-canvas`, or `auto` |
| `open` | `true` | Show/hide with spring |
| `mode` | `'drag'` | `drag`, `follow`, or `static` |
| `defaultPosition` | center | Initial position (`%` or px) |
| `position` | `n/a` | Controlled center in px |
| `smoothing` | `0.75` | Pointer follow smoothing |
| `inertia` | `true` | Flick glide |
| `bounded` | `true` | Keep center inside stage |
| `pressScale` | `1.04` | Press feedback scale |
| `quality` | `'auto'` | Texture resolution cap |
| `spectralSamples` | `8` | Dispersion samples (3 to 24) |
| `maxPixelRatio` | `2` | Lens canvas DPR cap |
| `background` | auto | Stage backdrop color |
| `autoRefresh` | `true` | Recapture on DOM changes |
| `refreshInterval` | `0` | Periodic recapture (ms) |
| `captureBudget` | `0.3` | Snapshot CPU budget while content moves |
| `captureStyles` | `'fast'` | `fast` visual-only clone or `full` |
| `onCapture` | `n/a` | After each capture |
| `onError` | `n/a` | WebGL or capture failure |

## Imperative handle

```tsx
const lens = useRef<LensStageHandle>(null);

<LensStage ref={lens}>…</LensStage>;

lens.current?.moveTo(320, 180);
lens.current?.center();
lens.current?.getPosition();
lens.current?.refresh();
lens.current?.capture; // active method
```

## HTML-in-Canvas (experimental)

[WICG HTML-in-Canvas](https://github.com/WICG/html-in-canvas) defines:

- `<canvas content="drawable">` with `drawable` on painted descendants
- `requestPaint()` and the `paint` event (`changedElements`)
- `texElementSubImage2D()` on WebGL for live compositor snapshots
- `updateElementGeometry()` for hit testing and accessibility geometry

```tsx
import { LensStage, supportsHtmlInCanvas } from 'react-glass-lens';

<LensStage capture="html-in-canvas">
  <VideoWall />
</LensStage>;

supportsHtmlInCanvas();
```

Experimental in Chromium (`CanvasDrawElement`). Falls back to DOM snapshot elsewhere or on error. `supportsHtmlInCanvas()` checks `requestPaint`, geometry helpers, and `texElementSubImage2D`.

## How it works

1. Stage content becomes a GPU texture (DOM snapshot or html-in-canvas).
2. A fragment shader traces rays through a glass dome onto that texture.
3. Dispersion retraces wavelengths only where channels diverge.
4. Lens motion updates uniforms; capture runs on DOM/theme changes (coalesced in snapshot mode).

## Notes

- Snapshot capture clones the stage on the main thread (~13 ms typical hero). Tune `captureBudget` and DOM size.
- Cross-origin images need CORS headers in snapshot mode.
- Without WebGL2, content still renders; the lens hides and `onError` runs.

## License

MIT