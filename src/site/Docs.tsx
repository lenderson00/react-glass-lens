import { useEffect, useState } from 'react';
import { Code } from './Code';
import { behaviourProps, callbackProps, handleMethods, opticsProps, renderingProps, type PropDoc } from './docsData';
import { PresetDemo } from './PresetDemo';
import { href } from './router';

const SECTIONS = [
  ['introduction', 'Introduction'],
  ['installation', 'Installation'],
  ['quick-start', 'Quick start'],
  ['how-it-works', 'How it works'],
  ['optics', 'Optics props'],
  ['behaviour', 'Behaviour props'],
  ['rendering', 'Rendering & capture'],
  ['html-in-canvas', 'HTML-in-Canvas'],
  ['callbacks', 'Callbacks'],
  ['ref', 'Imperative handle'],
  ['presets', 'Presets'],
  ['recipes', 'Recipes'],
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['support', 'Browser support'],
] as const;

function PropTable({ rows, label }: { rows: PropDoc[]; label: string }) {
  return (
    <div className="table-wrap">
      <table className="props" aria-label={label}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                <code>{r.name}</code>
              </td>
              <td>
                <code className="muted">{r.type}</code>
              </td>
              <td>
                <code className="muted">{r.default}</code>
              </td>
              <td>{renderInline(r.description)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `backticks` → <code>. */
function renderInline(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>,
  );
}

function useActiveSection() {
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return active;
}

export function Docs() {
  const active = useActiveSection();
  return (
    <div className="docs">
      <aside className="toc toc-desktop" aria-label="On this page">
        <span className="toc-title">Documentation</span>
        <nav>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={href('docs', id)} className={active === id ? 'on' : ''}>
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="docs-main">
        <div className="toc-rail-wrap" aria-hidden={false}>
          <span className="toc-rail-label">On this page</span>
          <nav className="toc-rail" aria-label="On this page">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={href('docs', id)} className={active === id ? 'on' : ''}>
                {label}
              </a>
            ))}
          </nav>
        </div>

      <article className="prose">
        <section id="introduction">
          <span className="eyebrow">react-glass-lens</span>
          <h1>Documentation</h1>
          <p className="lead">
            <code>&lt;LensStage&gt;</code> wraps any React content and puts a draggable glass lens on top of it. The lens
            refracts what is really underneath — text, images, components — with a per-pixel ray tracer in WebGL2.
          </p>
        </section>

        <section id="installation">
          <h2>Installation</h2>
          <Code lang="sh">npm i react-glass-lens</Code>
          <p>
            React 18 or 19 is a peer dependency. The only runtime dependency is{' '}
            <code>modern-screenshot</code>, used to turn the DOM into a texture.
          </p>
        </section>

        <section id="quick-start">
          <h2>Quick start</h2>
          <Code>{`
import { LensStage } from 'react-glass-lens';

export function Hero() {
  return (
    <LensStage style={{ height: 480 }}>
      <YourContent />
    </LensStage>
  );
}
`}</Code>
          <p>
            The stage is a <code>position: relative</code> block; give it a size. Everything inside is regular DOM —
            clicks, focus and state work as usual. Drag the lens, flick it, or focus it and use the arrow keys.
          </p>
          <Code title="Tuning">{`
import { LensStage, lensPresets } from 'react-glass-lens';

<LensStage config={lensPresets.magnifier} magnification={2.5} aberration={0.02}>
  <YourContent />
</LensStage>
`}</Code>
          <p>
            Precedence: built-in defaults &lt; <code>config</code> &lt; individual props. Use the{' '}
            <a href={href('playground')}>playground</a> to find values and copy the generated JSX.
          </p>
        </section>

        <section id="how-it-works">
          <h2>How it works</h2>
          <ol>
            <li>
              <strong>Capture.</strong> The stage is snapshotted into a texture (an SVG <code>foreignObject</code>{' '}
              rasterised by the browser), with mipmaps and anisotropic filtering. The lens itself is excluded.
            </li>
            <li>
              <strong>Trace.</strong> A fragment shader models a glass dome above the content. For every pixel it
              refracts a ray at the curved top (Snell’s law), again at the flat bottom, and follows it to the content. The
              centre is normalised so <code>magnification</code> is exact; the rim bends, compresses and finally inverts the
              image like a real ball lens.
            </li>
            <li>
              <strong>Disperse.</strong> Where colours separate, the ray is traced for several wavelengths and
              recombined — chromatic fringes without hard RGB splitting.
            </li>
            <li>
              <strong>Light.</strong> Optional Fresnel, specular and a soft cast shadow, all from the same surface
              normals.
            </li>
          </ol>
          <p>
            Moving the lens only changes uniforms, so it runs at display refresh rate. The texture is refreshed when the
            DOM inside the stage changes, when transitions end, when fonts load and when the theme changes.
          </p>
        </section>

        <section id="optics">
          <h2>Optics props</h2>
          <p>
            All optics live in <code>LensConfig</code> and can be passed one by one or as <code>config</code>.
          </p>
          <PropTable rows={opticsProps} label="Optics props" />
        </section>

        <section id="behaviour">
          <h2>Behaviour props</h2>
          <PropTable rows={behaviourProps} label="Behaviour props" />
        </section>

        <section id="rendering">
          <h2>Rendering &amp; capture</h2>
          <PropTable rows={renderingProps} label="Rendering props" />
        </section>

        <section id="html-in-canvas">
          <h2>HTML-in-Canvas</h2>
          <p>
            By default the content is <em>snapshotted</em>: the stage DOM is cloned into an image whenever it changes
            (~35–50 ms on the main thread). The{' '}
            <a href="https://github.com/WICG/html-in-canvas" target="_blank" rel="noreferrer">
              HTML-in-Canvas
            </a>{' '}
            proposal removes that cost: the stage becomes a <code>&lt;canvas content="drawable"&gt;</code>, your
            children are laid out and hit-tested as usual, and the browser hands their live pixels to WebGL every
            frame.
          </p>
          <Code>{`
import { LensStage, supportsHtmlInCanvas } from 'react-glass-lens';

<LensStage capture="html-in-canvas">   {/* falls back to snapshot when unsupported */}
  <VideoWall />                         {/* video, canvas and CSS animations stay live */}
</LensStage>

supportsHtmlInCanvas(); // feature detection
`}</Code>
          <ul>
            <li>The lens follows animations, video and dragging at full frame rate — no recapture, no stale frames.</li>
            <li>
              The API is experimental (Chromium, <code>CanvasDrawElement</code>). Other browsers and failures use snapshot
              capture automatically.
            </li>
            <li>
              In this mode the canvas paints the content itself. Text selection and native scrolling inside the stage
              depend on the browser's implementation of the proposal.
            </li>
          </ul>
        </section>

        <section id="callbacks">
          <h2>Callbacks</h2>
          <PropTable rows={callbackProps} label="Callbacks" />
        </section>

        <section id="ref">
          <h2>Imperative handle</h2>
          <Code>{`
import { useRef } from 'react';
import { LensStage, type LensStageHandle } from 'react-glass-lens';

const lens = useRef<LensStageHandle>(null);

<LensStage ref={lens}>…</LensStage>

lens.current?.moveTo(320, 180);                 // animated
lens.current?.moveTo(320, 180, { immediate: true });
lens.current?.center();
lens.current?.refresh();                         // recapture now
`}</Code>
          <PropTable rows={handleMethods} label="Handle methods" />
        </section>

        <section id="presets">
          <h2>Presets</h2>
          <p>
            <code>lensPresets</code> ships six starting points. <code>liquid</code> is UI glass in the spirit of
            Apple’s Liquid Glass: no zoom, a clear centre, refraction only in a thin rounded edge, a bright rim and a
            touch of frost. Pick one below — the lens updates live.
          </p>
          <PresetDemo />
        </section>

        <section id="recipes">
          <h2>Recipes</h2>

          <h3>Follow the cursor</h3>
          <Code>{`<LensStage mode="follow" smoothing={0.85} radius={120}>…</LensStage>`}</Code>

          <h3>Controlled position</h3>
          <Code>{`
const [pos, setPos] = useState({ x: 200, y: 160 });

<LensStage position={pos} onPositionChange={setPos}>…</LensStage>
`}</Code>

          <h3>Keep something out of the refraction</h3>
          <Code>{`<button data-lens-ignore>Not refracted</button>`}</Code>

          <h3>Video, canvas or infinite animations</h3>
          <p>
            These change pixels without touching the DOM, so automatic refresh can’t see them. Recapture on an
            interval, or call <code>refresh()</code> yourself.
          </p>
          <Code>{`<LensStage refreshInterval={100}>…</LensStage>`}</Code>

          <h3>Graceful fallback</h3>
          <Code>{`
<LensStage onError={() => track('lens-unavailable')}>
  <Content />  {/* always rendered, with or without the lens */}
</LensStage>
`}</Code>
        </section>

        <section id="performance">
          <h2>Performance</h2>
          <ul>
            <li>
              Moving the lens costs one draw call. On a desktop GPU the shader takes ~0.4 ms for an 820 px lens; work
              outside the glass disc is skipped and dispersion is only computed where colours separate.
            </li>
            <li>
              Recapturing clones the stage DOM on the main thread. Only the style properties that affect appearance are
              cloned (~13 ms for a typical hero, ~4× cheaper than cloning everything). Captures are coalesced, paused
              while the stage is off-screen or the tab is hidden, and throttled during bursts by{' '}
              <code>captureBudget</code> — dragging things under the lens keeps the page at 60 fps.
            </li>
            <li>
              Keep the stage lean: fewer DOM nodes = faster captures. Very large stages benefit from a lower{' '}
              <code>quality</code>.
            </li>
            <li>Changing the resolution (magnification, DPR) is debounced, so dragging sliders doesn’t thrash.</li>
          </ul>
        </section>

        <section id="accessibility">
          <h2>Accessibility</h2>
          <ul>
            <li>
              The lens is a focusable <code>role="slider"</code>; arrow keys move it, <kbd>Shift</kbd> moves faster. A
              focus ring shows for keyboard users only — colour via <code>--lens-focus-ring</code>.
            </li>
            <li>
              With <code>prefers-reduced-motion: reduce</code> there is no smoothing, no flick and no overshoot.
            </li>
            <li>The canvas is hidden from assistive technology; your content stays fully accessible.</li>
          </ul>
        </section>

        <section id="support">
          <h2>Browser support</h2>
          <p>
            Any browser with WebGL2: current Chrome, Edge, Firefox and Safari. Without it, <code>onError</code> fires and
            the content renders normally without the lens.
          </p>
          <ul>
            <li>Cross-origin images need CORS headers to appear in the capture.</li>
            <li>
              <code>position: fixed</code> elements inside the stage are captured relative to the stage, not the
              viewport.
            </li>
          </ul>
        </section>
      </article>
      </div>
    </div>
  );
}
