export const CAMERA = {
  /** Riding: camera stays behind the handlebars; drag only glances a little around the heading. */
  riding: { distance: 5.6, pitch: 0.24, focusHeight: 1.6, follow: 5, maxYaw: 0.4, maxPitch: 0.12 },
  walking: { distance: 5.4, pitch: 0.3, focusHeight: 1.4, follow: 7, maxYaw: Math.PI, maxPitch: 1 },
  /** Seconds after the last mouse drag before the walking camera swings back behind the avatar. */
  recenterDelay: 1.2,
  fov: 52,
} as const
