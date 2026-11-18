# react-glass-lens

A draggable glass lens for React that **really refracts** the DOM under it — per-pixel ray tracing in WebGL2, spectral
chromatic dispersion, a clean rim and soft shadows.

- **Real refraction** — Snell's law at the curved top and the flat bottom of a glass dome; the rim bends, compresses and
  finally inverts the image like a ball lens.
- **Any React content** — text, images, components. Rendered once; state, focus and clicks work as usual.
- **60 fps motion** — moving the lens is one draw call. Drag, flick with inertia, follow the cursor or drive it from code.
- **Accessible** — keyboard movable with a visible focus ring, respects `prefers-reduced-motion`.
- **Typed & small** — TypeScript types, ~13 kB gzipped, ESM + CommonJS, one runtime dependency.

## Install

```sh
npm i react-glass-lens
```

React 18 or 19 is a peer dependency.

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

The stage is a `position: relative` block — give it a size. Tune it with props or start from a preset:

```tsx
import { LensStage, lensPresets } from 'react-glass-lens';

<LensStage config={lensPresets.magnifier} magnification={2.5} aberration={0.02}>
  <YourContent />
</LensStage>;
```

Precedence: defaults < `config` < individual props.

## Optics props (`LensConfig`)

| prop            | default | description                                                         |
| --------------- | ------- | ------------------------------------------------------------------- |
| `radius`        | `258`   | Lens radius in CSS px                                               |
| `magnification` | `1.75`  | Zoom at the centre (exact)                                          |
| `ior`           | `1.52`  | Index of refraction (1.33 water, 1.52 glass, 2.4 diamond)           |
| `aberration`    | `0.054` | Chromatic dispersion: IOR spread between red and blue (`0` = off)   |
| `thickness`     | `0.6`   | Dome height ÷ radius (`1` = hemisphere)                             |
| `bevelStart`    | `0.33`  | 0–1, where the curvature starts; inside it the glass is flat        |
| `oblateness`    | `0.3`   | 0 = sphere, 1 = flat puck with a steep edge                         |
| `refraction`    | `0.3`   | Glass → content gap ÷ radius; bigger = stronger rim warp/inversion  |
| `specular`      | `0`     | Specular highlight (`0` = clean, reflection-free glass)             |
| `rim`           | `0.2`   | Fresnel reflection on the rim                                       |
| `shadow`        | `0.45`  | Cast shadow and glass haze                                          |
| `lightAngle`    | `-35`   | Light direction in degrees (0 = top, 90 = right)                    |
| `frost`         | `0`     | 0–1 frosted glass: blurs what is seen through the lens              |

## Behaviour & rendering props

| prop                         | default                  | description                                                     |
| ---------------------------- | ------------------------ | --------------------------------------------------------------- |
| `config`                     | —                        | `Partial<LensConfig>`, e.g. a preset                            |
| `capture`                    | `'snapshot'`             | `'snapshot'` · `'html-in-canvas'` (live, falls back) · `'auto'` |
| `open`                       | `true`                   | Show / hide with a spring                                       |
| `mode`                       | `'drag'`                 | `'drag'` · `'follow'` (tracks the pointer) · `'static'`         |
| `defaultPosition`            | `{ x: '50%', y: '50%' }` | Initial centre, px or `%` of the stage                          |
| `position`                   | —                        | Controlled centre `{ x, y }` in px                              |
| `smoothing`                  | `0.75`                   | 0 sticks to the pointer, 0.9 is floaty                          |
| `inertia`                    | `true`                   | Glide after a flick                                             |
| `bounded`                    | `true`                   | Keep the centre inside the stage                                |
| `pressScale`                 | `1.04`                   | Scale feedback while pressed                                    |
| `quality`                    | `'auto'`                 | Texture resolution × DPR (auto follows magnification, ~8 MP cap)|
| `spectralSamples`            | `8`                      | Max wavelengths for dispersion (3–24)                           |
| `maxPixelRatio`              | `2`                      | Cap for the lens canvas DPR                                     |
| `background`                 | auto                     | Colour outside the stage / before the first capture             |
| `autoRefresh`                | `true`                   | Recapture when the DOM inside the stage changes                 |
| `refreshInterval`            | `0`                      | Also recapture every N ms (video, canvas, CSS loops)            |
| `captureBudget`              | `0.3`                    | Snapshot mode: max share of main-thread time recaptures may use while content keeps changing (0.05–0.9) |
| `captureStyles`              | `'fast'`                 | `'fast'` clones only visual style props (~4× cheaper); `'full'` clones all |
| `onPositionChange`           | —                        | `(p) => void` while moving                                      |
| `onDragStart` / `onDragEnd`  | —                        | `(p) => void`                                                   |
| `onCapture`                  | —                        | `({ ms, width, height, method }) => void` after a capture       |
| `onError`                    | —                        | WebGL2 unavailable or capture failed — the lens hides           |
| `className`, `style`         | —                        | Stage element                                                   |
| `lensClassName`, `lensStyle` | —                        | Lens hit area                                                   |

## Imperative handle

```tsx
const lens = useRef<LensStageHandle>(null);

<LensStage ref={lens}>…</LensStage>;

lens.current?.moveTo(320, 180); // animated; { immediate: true } to jump
lens.current?.center();
lens.current?.getPosition();
lens.current?.refresh(); // recapture now
lens.current?.capture; // 'snapshot' | 'html-in-canvas'
```

## Presets

`lensPresets.crystal` (default), `orb`, `magnifier`, `droplet`, `subtle`, and `liquid` — UI glass in the spirit of
Apple's Liquid Glass: no zoom, a clear centre, refraction only in a thin rounded edge, a bright rim and a touch of frost.

## HTML-in-Canvas (experimental)

```tsx
import { LensStage, supportsHtmlInCanvas } from 'react-glass-lens';

<LensStage capture="html-in-canvas">
  <VideoWall /> {/* video, canvas and CSS animations stay live under the glass */}
</LensStage>;
```

With the [HTML-in-Canvas](https://github.com/WICG/html-in-canvas) proposal the stage becomes a
`<canvas content="drawable">`: children are laid out and hit-tested as usual, and the browser streams their live pixels
to WebGL every frame — no DOM cloning, no recapture delay. The API is experimental (Chromium, behind a flag at the time
of writing); everywhere else, or if it throws, the lens falls back to snapshot capture. `supportsHtmlInCanvas()` exposes
the feature detection.

## How it works

1. The stage is captured into a texture (an SVG `foreignObject` rasterised by the browser) with mipmaps and
   anisotropic filtering. The lens itself is excluded; add `data-lens-ignore` to exclude anything else.
2. A fragment shader traces a ray per pixel through the dome and onto the content. Dispersion re-traces a few
   wavelengths only where colours actually separate; pixels outside the glass skip all lens work.
3. The texture is refreshed automatically on DOM mutations, finished transitions/animations, font loads and theme
   changes. Captures are coalesced, throttled during bursts and paused while the stage is off-screen or the tab is
   hidden.

## Notes

- Capturing clones the stage DOM on the main thread (~13 ms for a typical hero; only visual style properties are
  cloned). Smaller DOM = faster refresh, and `captureBudget` keeps the page smooth while content changes.
- Cross-origin images need CORS to appear in the capture.
- Without WebGL2, `onError` fires and the content renders normally without the lens.

## License

MIT
