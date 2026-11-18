export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPos;
uniform vec2 uHalf;      // viewport half-size, CSS px
out vec2 vPx;            // fragment position relative to lens centre, CSS px, y down
out vec2 vUv;            // 0–1 over the viewport, y down
void main() {
  vPx = vec2(aPos.x, -aPos.y) * uHalf;
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** HTML-in-Canvas: paint the content texture as the stage itself. */
export const BLIT_FRAGMENT = /* glsl */ `#version 300 es
precision mediump float;
in vec2 vPx;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
void main() {
  vec4 c = texture(uTex, vUv);
  outColor = vec4(c.rgb * c.a, c.a);
}`;

/**
 * Per-pixel ray tracing through a radially symmetric glass dome.
 * Mirrors `traceRadius` in optics.ts (used on the CPU for the centre gain).
 */
export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

in vec2 vPx;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2  uTexSize;     // texture size, texels
uniform float uSharp;       // < 1 = prefer sharper mip levels
uniform float uFrost;       // 0 = clear, 1 = heavily frosted (mip blur)
uniform vec2  uStage;       // stage size, CSS px
uniform vec2  uCenter;      // lens centre in stage, CSS px
uniform float uRadius;      // animated radius (open / press)
uniform float uBaseRadius;  // configured radius
uniform float uMag;
uniform float uIor;
uniform float uDisp;
uniform float uThick;
uniform float uBevel;
uniform float uExp;
uniform float uGap;
uniform float uGain;
uniform float uSpec;
uniform float uRim;
uniform float uShade;
uniform float uShadow;
uniform vec3  uLight;
uniform vec3  uBg;
uniform float uPx;          // CSS px per device px
uniform float uAlpha;
uniform int   uSamples;

float surf(float r) {
  if (r >= 1.0) return 0.0;
  if (r <= uBevel) return 1.0;
  float t = (r - uBevel) / (1.0 - uBevel);
  return pow(max(0.0, 1.0 - pow(t, uExp)), 1.0 / uExp);
}

float slope(float r) {
  float e = 5e-4;
  float a = max(0.0, r - e);
  float b = min(0.99999, r + e);
  return (surf(b) - surf(a)) / (b - a);
}

// Landing radius on the content (normalised), centre-gain corrected.
float trace(float r, float h, float m, float ior) {
  vec2 n = normalize(vec2(-m, 1.0));
  float eta = 1.0 / ior;
  float cosi = n.y;
  float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
  float c = eta * cosi - sqrt(max(0.0, k));
  float tx = c * n.x;
  float tz = -eta + c * n.y;
  float inside = h * tx / max(1e-4, -tz);
  float ex = clamp(tx * ior, -0.985, 0.985);
  float ez = sqrt(1.0 - ex * ex);
  return (r + inside + uGap * ex / ez) / uGain;
}

// Rough spectral → RGB weights. t: 0 = red … 1 = violet.
vec3 spectrum(float t) {
  return clamp(vec3(1.0 - abs(t - 0.1) * 2.4, 1.0 - abs(t - 0.5) * 2.6, 1.0 - abs(t - 0.9) * 2.4), 0.0, 1.0);
}

vec3 stageColor(vec2 uv, vec2 gx, vec2 gy) {
  vec4 c = textureGrad(uTex, uv, gx, gy);
  // Transparent areas (HTML-in-Canvas snapshots) show the page background.
  vec3 rgb = mix(uBg, c.rgb, c.a);
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return mix(uBg, rgb, inb.x * inb.y * uHasTex);
}

void main() {
  float R = max(uRadius, 1e-3);
  float d = length(vPx);
  float r = min(d / R, 0.99999);
  vec2 dir = d > 1e-4 ? vPx / d : vec2(0.0);
  float cover = clamp((R - d) / uPx + 0.5, 0.0, 1.0);

  float h = surf(r) * uThick;
  float m = slope(r) * uThick;

  // Reference ray: also gives screen-space derivatives for mip selection.
  float s0 = trace(r, h, m, uIor);
  float k0 = r > 1e-3 ? s0 / r : 1.0;
  vec2 uv0 = (uCenter + vPx * k0 / uMag) / uStage;
  // Mip selection: bias towards sharp and cap the footprint, so stretched areas
  // stay crisp and folds (where derivatives explode) don't turn into mush.
  vec2 gx = dFdx(uv0) * uTexSize * uSharp;
  vec2 gy = dFdy(uv0) * uTexSize * uSharp;
  float lx = length(gx), ly = length(gy);
  gx *= min(1.0, 6.0 / max(lx, 1e-6));
  gy *= min(1.0, 6.0 / max(ly, 1e-6));
  // Frost widens the filter footprint → blurrier mip levels, for free.
  float frost = exp2(uFrost * 5.0);
  gx *= frost / uTexSize;
  gy *= frost / uTexSize;

  // ---- cast shadow (premultiplied black) ----
  vec2 so = -uLight.xy / max(uLight.z, 0.2) * uBaseRadius * 0.12 + vec2(0.0, uBaseRadius * 0.06);
  float sd = length(vPx - so);
  float sa = uShadow * (0.3 * (1.0 - smoothstep(R * 0.5, R * 1.3, sd)) + 0.16 * (1.0 - smoothstep(R * 0.92, R * 1.06, d)));
  vec4 shadow = vec4(0.0, 0.0, 0.0, clamp(sa, 0.0, 1.0));

  // ~70% of the canvas is shadow margin: skip all lens work there.
  if (cover <= 0.0) {
    outColor = shadow * uAlpha;
    return;
  }

  // Dispersion only where the colours actually separate: measure the
  // red↔violet spread here (in lens px) and size the spectral loop to it.
  int samples = 1;
  if (uSamples > 1) {
    float spreadPx = abs(trace(r, h, m, uIor + uDisp) - trace(r, h, m, uIor - uDisp)) * R;
    if (spreadPx > 0.35) samples = clamp(int(ceil(spreadPx / 1.5)) + 1, 3, uSamples);
  }

  vec3 col;
  if (samples <= 1) {
    col = stageColor(uv0, gx, gy);
  } else {
    vec3 acc = vec3(0.0);
    vec3 wsum = vec3(0.0);
    for (int i = 0; i < 24; i++) {
      if (i >= samples) break;
      float t = (float(i) + 0.5) / float(samples);
      float s = trace(r, h, m, uIor + uDisp * (t * 2.0 - 1.0));
      float k = r > 1e-3 ? s / r : 1.0;
      vec3 w = spectrum(t);
      acc += stageColor((uCenter + vPx * k / uMag) / uStage, gx, gy) * w;
      wsum += w;
    }
    col = acc / max(wsum, vec3(1e-4));
  }

  // ---- lighting ----
  vec3 n3 = normalize(vec3(-m * dir, 1.0));
  float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
  float fres = f0 + (1.0 - f0) * pow(1.0 - n3.z, 5.0);
  vec3 refl = reflect(vec3(0.0, 0.0, -1.0), n3);
  vec2 l2 = normalize(uLight.xy + vec2(1e-5));
  float facing = -dot(dir, l2);           // 1 on the side away from the light
  float lit = 0.5 - 0.5 * facing;         // 1 on the lit side

  // Studio environment: bright soft-box towards the light, grey floor away from it.
  float toLight = dot(normalize(refl.xy + vec2(1e-5)), l2);
  vec3 envc = mix(vec3(0.46), vec3(1.0), smoothstep(-0.7, 0.6, toLight * (1.0 - refl.z)));
  envc += pow(max(0.0, dot(refl, uLight)), 10.0) * 0.5;
  col = mix(col, min(envc, vec3(1.0)), clamp(fres * uRim * 0.7, 0.0, 0.8));

  // Body: thick glass picks up a soft grey haze towards the rim, away from the light.
  float haze = smoothstep(0.3, 1.0, r) * (0.25 + 0.75 * (0.5 + 0.5 * facing));
  col = mix(col, vec3(0.5), clamp(uShade * haze * 0.15, 0.0, 0.5));

  vec3 H = normalize(uLight + vec3(0.0, 0.0, 1.0));
  float ndh = max(0.0, dot(n3, H));
  float spec = pow(ndh, 120.0) * 1.1 + pow(ndh, 14.0) * 0.1;
  float caustic = smoothstep(0.55, 0.93, r) * (1.0 - smoothstep(0.93, 1.0, r)) * pow(max(0.0, facing), 2.0) * 0.3;
  col += (spec + caustic) * uSpec;

  // Thin bright rim line (no dark bezel).
  float edgeW = max(1.2 * uPx / R, 0.006);
  float edge = smoothstep(1.0 - edgeW * 2.5, 1.0 - edgeW * 0.5, r);
  col = mix(col, vec3(1.0), edge * (0.25 + 0.4 * lit) * min(1.0, 0.3 + uRim));

  vec4 lens = vec4(clamp(col, 0.0, 1.0), 1.0) * cover;

  outColor = (lens + shadow * (1.0 - lens.a)) * uAlpha;
}`;
