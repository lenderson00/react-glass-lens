import { defaultLensConfig, type LensConfig } from 'react-glass-lens';

export interface PropDoc {
  name: string;
  type: string;
  default: string;
  description: string;
}

const d = (k: keyof LensConfig) => String(defaultLensConfig[k]);

export const opticsProps: PropDoc[] = [
  { name: 'radius', type: 'number', default: d('radius'), description: 'Lens radius in CSS pixels.' },
  { name: 'magnification', type: 'number', default: d('magnification'), description: 'Zoom at the very centre of the lens. `1` = no zoom. Exact, independent of the other optics.' },
  { name: 'ior', type: 'number', default: d('ior'), description: 'Index of refraction: 1.33 water, 1.52 glass, 2.4 diamond.' },
  { name: 'aberration', type: 'number', default: d('aberration'), description: 'Chromatic dispersion — IOR spread between red and blue. `0` disables it.' },
  { name: 'thickness', type: 'number', default: d('thickness'), description: 'Dome height relative to the radius (`1` = hemisphere). Thicker glass bends harder at the rim.' },
  { name: 'bevelStart', type: 'number', default: d('bevelStart'), description: '0–1. Where the curvature starts; inside it the glass is flat and undistorted.' },
  { name: 'oblateness', type: 'number', default: d('oblateness'), description: '0 = round sphere profile, 1 = flat puck with a steep edge.' },
  { name: 'refraction', type: 'number', default: d('refraction'), description: 'Gap between glass and content (× radius). Bigger = the rim warps and inverts more.' },
  { name: 'specular', type: 'number', default: d('specular'), description: 'Specular highlight strength. `0` gives clean, reflection-free glass.' },
  { name: 'rim', type: 'number', default: d('rim'), description: 'Fresnel reflection on the rim.' },
  { name: 'shadow', type: 'number', default: d('shadow'), description: 'Cast shadow and the soft haze inside the glass.' },
  { name: 'lightAngle', type: 'number', default: d('lightAngle'), description: 'Light direction in degrees: 0 = top, 90 = right, −90 = left.' },
  { name: 'frost', type: 'number', default: d('frost'), description: '0–1. Frosted glass: blurs what is seen through the lens. `0` = perfectly clear.' },
];

export const behaviourProps: PropDoc[] = [
  { name: 'children', type: 'ReactNode', default: '—', description: 'The content under the lens. Rendered once, like any other children.' },
  { name: 'config', type: 'Partial<LensConfig>', default: '—', description: 'A whole optics object (e.g. a preset). Individual props override it.' },
  { name: 'open', type: 'boolean', default: 'true', description: 'Shows / hides the lens with a spring.' },
  { name: 'mode', type: "'drag' | 'follow' | 'static'", default: "'drag'", description: 'Grab and move, track the pointer, or position only through `position`.' },
  { name: 'defaultPosition', type: '{ x, y }', default: "{ x: '50%', y: '50%' }", description: 'Initial centre, in px or percentages of the stage (uncontrolled).' },
  { name: 'position', type: '{ x: number; y: number }', default: '—', description: 'Controlled centre, in px relative to the stage.' },
  { name: 'smoothing', type: 'number', default: '0.75', description: '0 sticks to the pointer; 0.9 is very floaty.' },
  { name: 'inertia', type: 'boolean', default: 'true', description: 'Keep gliding after a flick, with friction.' },
  { name: 'bounded', type: 'boolean', default: 'true', description: 'Keep the lens centre inside the stage.' },
  { name: 'pressScale', type: 'number', default: '1.04', description: 'Scale feedback while pressed.' },
  { name: 'className / style', type: 'string / CSSProperties', default: '—', description: 'Applied to the stage element.' },
  { name: 'lensClassName / lensStyle', type: 'string / CSSProperties', default: '—', description: 'Applied to the lens hit area.' },
  { name: 'aria-label', type: 'string', default: '—', description: 'Accessible name of the lens (it is a keyboard-movable slider).' },
];

export const renderingProps: PropDoc[] = [
  { name: 'capture', type: "'snapshot' | 'html-in-canvas' | 'auto'", default: "'snapshot'", description: 'How the content reaches the GPU. `html-in-canvas` streams it live through the experimental HTML-in-Canvas API and falls back to `snapshot` where it is missing. `auto` = `html-in-canvas`.' },
  { name: 'quality', type: "number | 'auto'", default: "'auto'", description: 'Content texture resolution × devicePixelRatio. Auto follows the magnification, within an ~8 MP budget.' },
  { name: 'spectralSamples', type: 'number', default: '8', description: 'Max wavelengths for dispersion (3–24). Only used where colours actually separate.' },
  { name: 'maxPixelRatio', type: 'number', default: '2', description: 'Cap for the lens canvas DPR.' },
  { name: 'background', type: 'string', default: 'auto', description: 'Colour outside the stage / before the first capture. Detected from the stage.' },
  { name: 'autoRefresh', type: 'boolean', default: 'true', description: 'Recapture when the DOM inside the stage changes.' },
  { name: 'captureBudget', type: 'number', default: '0.3', description: 'Snapshot mode: max share (0.05–0.9) of main-thread time recaptures may use while the content keeps changing, e.g. while dragging something under the lens. Lower = smoother page, laggier lens.' },
  { name: 'captureStyles', type: "'fast' | 'full'", default: "'fast'", description: "Snapshot mode: `fast` clones only the style properties that affect appearance (~4× cheaper, pixel-identical in practice). `full` clones every computed property — use it if some exotic CSS is missing from the lens." },
  { name: 'refreshInterval', type: 'number', default: '0', description: 'Also recapture every N ms — for canvas, video or infinite CSS animations.' },
];

export const callbackProps: PropDoc[] = [
  { name: 'onPositionChange', type: '(p: LensPoint) => void', default: '—', description: 'While the lens moves (target position, before smoothing).' },
  { name: 'onDragStart / onDragEnd', type: '(p: LensPoint) => void', default: '—', description: 'Start / end of a drag.' },
  { name: 'onCapture', type: '(info: CaptureInfo) => void', default: '—', description: 'After content capture: `{ ms, width, height, method }` (throttled in HTML-in-Canvas mode).' },
  { name: 'onError', type: '(error: unknown) => void', default: '—', description: 'WebGL2 is unavailable or capturing failed. The lens hides; the content stays.' },
];

export const handleMethods: PropDoc[] = [
  { name: 'moveTo(x, y, { immediate? })', type: 'void', default: '—', description: 'Move the lens centre (stage px). Animated unless `immediate`.' },
  { name: 'center({ immediate? })', type: 'void', default: '—', description: 'Move back to the stage centre.' },
  { name: 'getPosition()', type: 'LensPoint', default: '—', description: 'Current (animated) centre.' },
  { name: 'refresh()', type: 'void', default: '—', description: 'Recapture the content now.' },
  { name: 'capture', type: "'snapshot' | 'html-in-canvas'", default: '—', description: 'Capture method actually in use.' },
  { name: 'element', type: 'HTMLDivElement | null', default: '—', description: 'The stage element.' },
];
