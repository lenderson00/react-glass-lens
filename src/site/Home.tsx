import { LensStage } from 'react-glass-lens';
import { useViewportStage } from '../lib/useViewportStage';
import { Scene, initialStickers } from '../playground/Scene';
import { Code, InstallPill } from './Code';
import { PresetDemo } from './PresetDemo';
import { href } from './router';
import { useStickers } from './useStickers';

const FEATURES = [
  {
    title: 'Real refraction',
    body: 'Per-pixel ray tracing through a glass dome — Snell’s law at both surfaces, not a blur or a scale trick.',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-5 9h10M12 7v10',
  },
  {
    title: 'Spectral dispersion',
    body: 'Several wavelengths are traced where colours actually split, for soft prismatic fringes on the rim.',
    icon: 'M3 18 12 4l9 14H3Zm4-4h10',
  },
  {
    title: 'Any React content',
    body: 'Text, images, components. Rendered once, fully interactive, with state and focus intact.',
    icon: 'M4 5h16v14H4zM4 9h16M8 13h5',
  },
  {
    title: '60 fps, even live',
    body: 'Moving the lens is one draw call. With HTML-in-Canvas, video and animations under the glass stay live too.',
    icon: 'M4 12h4l2-6 4 12 2-6h4',
  },
  {
    title: 'Accessible',
    body: 'Keyboard movable with a visible focus ring, respects reduced motion, hidden from screen readers.',
    icon: 'M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-7 3h14M12 8v6m0 0-3 7m3-7 3 7',
  },
  {
    title: 'Typed & tiny',
    body: 'First-class TypeScript, ~13 kB gzipped, one runtime dependency, ESM and CommonJS builds.',
    icon: 'M7 8l-4 4 4 4m10-8 4 4-4 4M14 4l-4 16',
  },
];

export function Home() {
  const { stickers, draggingId, onStickerPointerDown } = useStickers(initialStickers);
  const { radius: viewportRadius, stickerScale } = useViewportStage(258);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">React · WebGL2 · TypeScript</span>
          <h1>
            Real glass,
            <br />
            for the <em>DOM</em>.
          </h1>
          <p className="lead">
            A draggable lens that refracts whatever React renders under it — with spectral dispersion, a clean rim and
            soft shadows. One component, a handful of props.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href={href('docs', 'quick-start')}>
              Get started
            </a>
            <a className="btn" href={href('playground')}>
              Open playground
            </a>
          </div>
          <InstallPill />
        </div>

        <LensStage
          className="hero-stage"
          radius={viewportRadius}
          defaultPosition={{ x: '50%', y: '52%' }}
          aria-label="Demo lens. Drag it, or use the arrow keys."
        >
          <Scene
            heading={false}
            stickers={stickers}
            draggingId={draggingId}
            onStickerPointerDown={onStickerPointerDown}
            layoutScale={stickerScale}
          />
        </LensStage>
        <p className="hero-hint">Drag the glass. Flick it. Drag the stickers under it.</p>
      </section>

      <section className="band">
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={f.icon} />
              </svg>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="band split">
        <div>
          <span className="eyebrow">Quick start</span>
          <h2>Wrap it. Ship it.</h2>
          <p>
            Put your content inside <code>&lt;LensStage&gt;</code> and give the stage a size. Every optical property is a
            prop — or start from a preset.
          </p>
          <a className="link" href={href('docs')}>
            Read the docs →
          </a>
        </div>
        <Code title="App.tsx">{`
import { LensStage, lensPresets } from 'react-glass-lens';

export default function App() {
  return (
    <LensStage
      config={lensPresets.crystal}
      magnification={1.75}
      aberration={0.03}
      style={{ height: 520 }}
    >
      <Gallery />
    </LensStage>
  );
}
`}</Code>
      </section>

      <section className="band">
        <div className="band-head">
          <span className="eyebrow">Presets</span>
          <h2>Six kinds of glass</h2>
          <p>
            From Liquid-Glass-style UI chrome to a crystal ball that flips the world. Tweak any of them in the
            playground.
          </p>
        </div>
        <PresetDemo height={420} />
      </section>
    </>
  );
}
