import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

export interface StickerState {
  id: string;
  x: number; // px from stage centre
  y: number;
  rot: number;
  z: number;
}

export const initialStickers: StickerState[] = [
  { id: 'stamp', x: -330, y: 40, rot: -6, z: 1 },
  { id: 'tag', x: -250, y: -30, rot: -24, z: 3 },
  { id: 'key', x: -150, y: 40, rot: 4, z: 2 },
  { id: 'pixel', x: -100, y: 120, rot: 8, z: 5 },
  { id: 'rings', x: 10, y: 50, rot: 0, z: 4 },
  { id: 'checker', x: 110, y: -10, rot: 12, z: 2 },
  { id: 'card', x: 150, y: 90, rot: 10, z: 3 },
  { id: 'hand', x: 60, y: 150, rot: -8, z: 6 },
  { id: 'poster', x: 300, y: 40, rot: 3, z: 1 },
  { id: 'pill', x: 330, y: 110, rot: -12, z: 7 },
];

const Stamp = () => (
  <div className="st st-stamp">
    <div className="st-stamp-in">
      <span className="arc">THE OPTICS DEPARTMENT</span>
      <span className="since">· SINCE ·</span>
      <b>2026</b>
      <span className="small">REFRACTION<br />SQUARE</span>
    </div>
  </div>
);

const Tag = () => (
  <div className="st st-tag">
    <b>LNS</b>
    <span>1.52 · 0.04 · 160</span>
  </div>
);

const Key = () => (
  <div className="st st-key">
    <div className="cap">⌥</div>
  </div>
);

const Pixel = () => (
  <div className="st st-pixel">
    <b>100% GLASS</b>
    <span>REFRACTION CLUB</span>
  </div>
);

const Rings = () => <div className="st st-rings" />;

const Checker = () => <div className="st st-checker" />;

const Card = () => (
  <div className="st st-card">
    <div className="row">
      <span>2x</span>
      <span className="muted">Suffix</span>
    </div>
    <div className="row btn">⬚ Export Frame</div>
  </div>
);

const Hand = () => <div className="st st-hand">look closer</div>;

const Poster = () => (
  <div className="st st-poster">
    <div className="st-poster-in">
      <small>LAB Nº 152</small>
      <b>PRIS<br />MA</b>
      <small>2026</small>
    </div>
  </div>
);

const Pill = () => (
  <div className="st st-pill">
    <i>Lorem</i> <b>Lens</b>
    <small>THIS IS A PLACEHOLDER STICKER</small>
  </div>
);

const art: Record<string, () => ReactNode> = {
  stamp: Stamp,
  tag: Tag,
  key: Key,
  pixel: Pixel,
  rings: Rings,
  checker: Checker,
  card: Card,
  hand: Hand,
  poster: Poster,
  pill: Pill,
};

interface SceneProps {
  /** Show the title block above the stickers. Default `true`. */
  heading?: boolean;
  stickers: StickerState[];
  draggingId?: string | null;
  onStickerPointerDown?: (id: string, e: ReactPointerEvent<HTMLDivElement>) => void;
  /** Scales sticker spread for narrow viewports. Default `1`. */
  layoutScale?: number;
}

export function Scene({ heading = true, stickers, draggingId, onStickerPointerDown, layoutScale = 1 }: SceneProps) {
  return (
    <div className={`scene${heading ? '' : ' no-heading'}`} style={{ ['--scene-scale' as string]: layoutScale }}>
      {heading && (
        <header className="scene-head">
          <span className="eyebrow">PLAYGROUND</span>
          <h1>Glass Lens</h1>
          <p>Meanwhile, click, drag and explore ↓</p>
        </header>
      )}
      <div className="stickers">
        {stickers.map((s) => {
          const Art = art[s.id];
          const style: CSSProperties = {
            transform: `translate(-50%, -50%) translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg) scale(${
              draggingId === s.id ? 1.06 : 1
            })`,
            zIndex: s.z,
          };
          return (
            <div
              key={s.id}
              className={`sticker${draggingId === s.id ? ' is-dragging' : ''}`}
              style={style}
              onPointerDown={onStickerPointerDown ? (e) => onStickerPointerDown(s.id, e) : undefined}
            >
              <Art />
            </div>
          );
        })}
      </div>
    </div>
  );
}
