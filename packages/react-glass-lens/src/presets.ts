export interface LensConfig {
  /** Lens radius in CSS px. */
  radius: number;
  /** Zoom at the centre of the lens. 1 = no zoom. */
  magnification: number;
  /** Index of refraction (1.33 water, 1.52 glass, 2.4 diamond). */
  ior: number;
  /** Chromatic dispersion (IOR spread between red and blue). 0 = off. */
  aberration: number;
  /** Dome height relative to radius (1 = hemisphere). */
  thickness: number;
  /** 0–1: where the bevel starts. Inside it the glass is flat and undistorted. */
  bevelStart: number;
  /** 0–1: 0 = round sphere, 1 = flat puck with steep edge. */
  oblateness: number;
  /** Distance between glass and content (× radius). Drives how hard the rim warps. */
  refraction: number;
  /** Specular highlight strength. */
  specular: number;
  /** Fresnel rim reflection strength. */
  rim: number;
  /** Inner edge shading + drop shadow strength. */
  shadow: number;
  /** Light direction in degrees (0 = top, 90 = right, -90 = left). */
  lightAngle: number;
  /** 0–1: frosted glass — blurs what is seen through the lens. 0 = perfectly clear. */
  frost: number;
}

export const defaultLensConfig: LensConfig = {
  radius: 258,
  magnification: 1.75,
  ior: 1.52,
  aberration: 0.054,
  thickness: 0.6,
  bevelStart: 0.33,
  oblateness: 0.3,
  refraction: 0.3,
  specular: 0,
  rim: 0.2,
  shadow: 0.45,
  lightAngle: -35,
  frost: 0,
};

export const lensPresets = {
  crystal: defaultLensConfig,
  orb: {
    ...defaultLensConfig,
    magnification: 1.3,
    thickness: 1,
    bevelStart: 0,
    oblateness: 0,
    refraction: 0.55,
    aberration: 0.008,
  },
  magnifier: {
    ...defaultLensConfig,
    magnification: 2.2,
    thickness: 0.35,
    bevelStart: 0.72,
    oblateness: 0.5,
    refraction: 0.12,
    aberration: 0.008,
    specular: 0.6,
  },
  droplet: {
    ...defaultLensConfig,
    radius: 120,
    ior: 1.33,
    magnification: 1.15,
    thickness: 0.55,
    bevelStart: 0.25,
    oblateness: 0.55,
    refraction: 0.25,
    aberration: 0.005,
    shadow: 0.35,
  },
  subtle: {
    ...defaultLensConfig,
    magnification: 1.05,
    thickness: 0.3,
    bevelStart: 0.82,
    oblateness: 0.8,
    refraction: 0.08,
    aberration: 0.006,
    specular: 0.5,
    rim: 0.5,
    shadow: 0.3,
  },
  /**
   * UI glass in the spirit of Apple's "Liquid Glass": no zoom, a flat clear
   * centre, refraction only in a thin rounded edge, a bright specular rim and
   * a touch of frost.
   */
  liquid: {
    ...defaultLensConfig,
    radius: 150,
    magnification: 1.04,
    ior: 1.5,
    aberration: 0.012,
    thickness: 0.45,
    bevelStart: 0.7,
    oblateness: 0.85,
    refraction: 0.16,
    specular: 0.55,
    rim: 1.1,
    shadow: 0.45,
    lightAngle: -40,
    frost: 0.18,
  },
} satisfies Record<string, LensConfig>;

export type LensPresetName = keyof typeof lensPresets;
