import { useState } from 'react';
import { LensStage, lensPresets, type LensPresetName } from 'react-glass-lens';

export const PRESET_NAMES: Record<LensPresetName, string> = {
  crystal: 'Crystal',
  orb: 'Orb',
  magnifier: 'Magnifier',
  droplet: 'Droplet',
  subtle: 'Subtle',
  liquid: 'Liquid Glass',
};

/** A type-specimen poster: high-contrast detail so refraction reads well. */
export function Specimen() {
  return (
    <div className="specimen">
      <div className="specimen-grid" aria-hidden />
      <div className="specimen-rings" aria-hidden />
      <div className="specimen-checker" aria-hidden />
      <p className="specimen-kicker">Index of refraction · 1.520</p>
      <p className="specimen-word">
        Glass<em>lens</em>
      </p>
      <p className="specimen-body">
        Light slows down in glass and bends at every curved surface. Near the rim the rays cross and the picture turns
        upside down — the reason a crystal ball shows the world inverted.
      </p>
      <div className="specimen-bars" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ height: `${20 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
    </div>
  );
}

export function PresetDemo({ height = 380 }: { height?: number }) {
  const [preset, setPreset] = useState<LensPresetName>('crystal');
  const cfg = lensPresets[preset];
  return (
    <div className="preset-demo">
      <div className="chips" role="radiogroup" aria-label="Preset">
        {(Object.keys(PRESET_NAMES) as LensPresetName[]).map((p) => (
          <button key={p} role="radio" aria-checked={p === preset} className={p === preset ? 'on' : ''} onClick={() => setPreset(p)}>
            {PRESET_NAMES[p]}
          </button>
        ))}
      </div>
      <LensStage
        className="demo-stage"
        style={{ height }}
        config={cfg}
        radius={Math.min(cfg.radius, height * 0.36)}
        defaultPosition={{ x: '30%', y: '46%' }}
        aria-label={`${PRESET_NAMES[preset]} lens. Use the arrow keys to move it.`}
      >
        <Specimen />
      </LensStage>
      <code className="preset-code">
        {'<LensStage config={lensPresets.'}
        {preset}
        {'} />'}
      </code>
    </div>
  );
}
