import { BLIT_FRAGMENT, FRAGMENT, VERTEX } from './shaders';

export interface LensFrame {
  /** Lens box size in CSS px (the area the lens + its shadow can cover). */
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
  stage: [number, number];
  center: [number, number];
  radius: number;
  baseRadius: number;
  magnification: number;
  ior: number;
  dispersion: number;
  thickness: number;
  bevel: number;
  exponent: number;
  gap: number;
  gain: number;
  specular: number;
  rim: number;
  shade: number;
  shadow: number;
  frost: number;
  light: [number, number, number];
  background: [number, number, number];
  alpha: number;
  samples: number;
}

const UNIFORMS = [
  'uHalf', 'uTex', 'uHasTex', 'uTexSize', 'uSharp', 'uFrost', 'uStage', 'uCenter', 'uRadius', 'uBaseRadius', 'uMag',
  'uIor', 'uDisp', 'uThick', 'uBevel', 'uExp', 'uGap', 'uGain', 'uSpec', 'uRim', 'uShade', 'uShadow', 'uLight', 'uBg',
  'uPx', 'uAlpha', 'uSamples',
] as const;

type UniformName = (typeof UNIFORMS)[number];

/** HTML-in-Canvas additions (WICG proposal), not yet in lib.dom. */
interface ElementTextureGL {
  texElementSubImage2D?: (
    target: number,
    level: number,
    x: number,
    y: number,
    element: Element,
    config?: { width?: number; height?: number },
  ) => void;
  texElementImage2D?: (...args: unknown[]) => void;
}
interface DrawableCanvas {
  getElementImageDefaultSize?: (el: Element) => { width: number; height: number };
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Lens shader: ${log}`);
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, fragment: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Lens program: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

/**
 * Owns the WebGL2 context, the shader programs and the content texture.
 *
 * Two ways to draw:
 * - `render()`  — the canvas is just the lens box (snapshot capture mode).
 * - `renderStage()` — the canvas is the whole stage (HTML-in-Canvas mode):
 *   the content is blitted first and the lens is composited on top.
 */
export class LensRenderer {
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private blit: WebGLProgram;
  private blitTex: WebGLUniformLocation | null;
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private texture: WebGLTexture;
  private loc = {} as Record<UniformName, WebGLUniformLocation | null>;
  private hasTexture = false;
  private texSize: [number, number] = [1, 1];
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;

    this.program = link(gl, FRAGMENT);
    for (const u of UNIFORMS) this.loc[u] = gl.getUniformLocation(this.program, u);
    this.blit = link(gl, BLIT_FRAGMENT);
    this.blitTex = gl.getUniformLocation(this.blit, 'uTex');

    // Single full-screen triangle.
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      // 8× is visually indistinguishable here and much cheaper than 16× on mobile GPUs.
      const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
  }

  get maxTextureSize() {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
  }

  /** Upload a captured frame of the stage (with mipmaps for clean minification on the rim). */
  upload(source: TexImageSource) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.hasTexture = true;
    const s = source as { width: number; height: number };
    this.texSize = [s.width || 1, s.height || 1];
  }

  /**
   * HTML-in-Canvas: upload the latest snapshot of a `drawable` element straight
   * from the compositor. `size` is the texture size in device px.
   */
  uploadElement(element: Element, size: [number, number]) {
    const gl = this.gl;
    const egl = gl as unknown as ElementTextureGL;
    const canvas = this.canvas as unknown as DrawableCanvas;
    const [w, h] = size[0] > 0 ? size : (() => {
      const d = canvas.getElementImageDefaultSize?.(element);
      return [Math.round(d?.width ?? 1), Math.round(d?.height ?? 1)];
    })();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (this.texSize[0] !== w || this.texSize[1] !== h || !this.hasTexture) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    if (egl.texElementSubImage2D) {
      try {
        egl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element, { width: w, height: h });
      } catch {
        egl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element);
      }
    } else if (egl.texElementImage2D) {
      // Earlier shape of the proposal.
      egl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element);
    } else {
      throw new Error('HTML-in-Canvas is not available');
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    this.hasTexture = true;
    this.texSize = [w, h];
  }

  private setLensUniforms(f: LensFrame) {
    const gl = this.gl;
    const l = this.loc;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform2f(l.uHalf, f.cssWidth / 2, f.cssHeight / 2);
    gl.uniform1i(l.uTex, 0);
    gl.uniform1f(l.uHasTex, this.hasTexture ? 1 : 0);
    gl.uniform2f(l.uTexSize, this.texSize[0], this.texSize[1]);
    gl.uniform1f(l.uSharp, 0.6);
    gl.uniform1f(l.uFrost, Math.max(0, f.frost));
    gl.uniform2f(l.uStage, Math.max(1, f.stage[0]), Math.max(1, f.stage[1]));
    gl.uniform2f(l.uCenter, f.center[0], f.center[1]);
    gl.uniform1f(l.uRadius, f.radius);
    gl.uniform1f(l.uBaseRadius, f.baseRadius);
    gl.uniform1f(l.uMag, Math.max(0.05, f.magnification));
    gl.uniform1f(l.uIor, Math.max(1.0001, f.ior));
    gl.uniform1f(l.uDisp, f.dispersion);
    gl.uniform1f(l.uThick, f.thickness);
    gl.uniform1f(l.uBevel, Math.min(0.98, Math.max(0, f.bevel)));
    gl.uniform1f(l.uExp, f.exponent);
    gl.uniform1f(l.uGap, f.gap);
    gl.uniform1f(l.uGain, f.gain);
    gl.uniform1f(l.uSpec, f.specular);
    gl.uniform1f(l.uRim, f.rim);
    gl.uniform1f(l.uShade, f.shade);
    gl.uniform1f(l.uShadow, f.shadow);
    gl.uniform3f(l.uLight, ...f.light);
    gl.uniform3f(l.uBg, ...f.background);
    gl.uniform1f(l.uPx, 1 / f.pixelRatio);
    gl.uniform1f(l.uAlpha, f.alpha);
    gl.uniform1i(l.uSamples, f.samples);
  }

  private resize(w: number, h: number) {
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  /** Snapshot mode: the canvas is the lens box, centred on the lens. */
  render(f: LensFrame) {
    const gl = this.gl;
    const w = Math.max(1, Math.round(f.cssWidth * f.pixelRatio));
    const h = Math.max(1, Math.round(f.cssHeight * f.pixelRatio));
    this.resize(w, h);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (f.alpha <= 0.001 || f.radius <= 0.5) return;
    this.setLensUniforms(f);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** HTML-in-Canvas mode: the canvas is the whole stage. */
  renderStage(f: LensFrame) {
    const gl = this.gl;
    const dpr = f.pixelRatio;
    const w = Math.max(1, Math.round(f.stage[0] * dpr));
    const h = Math.max(1, Math.round(f.stage[1] * dpr));
    this.resize(w, h);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(this.vao);

    // 1. The content itself (the canvas replaces the DOM paint).
    if (this.hasTexture) {
      gl.disable(gl.BLEND);
      gl.useProgram(this.blit);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.blitTex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 2. The lens, composited over it in its own viewport (y is up in GL).
    if (f.alpha > 0.001 && f.radius > 0.5) {
      this.setLensUniforms(f);
      const bw = f.cssWidth * dpr;
      const bh = f.cssHeight * dpr;
      const x = (f.center[0] - f.cssWidth / 2) * dpr;
      const yTop = (f.center[1] - f.cssHeight / 2) * dpr;
      gl.viewport(Math.round(x), Math.round(h - yTop - bh), Math.round(bw), Math.round(bh));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.blit);
  }
}
