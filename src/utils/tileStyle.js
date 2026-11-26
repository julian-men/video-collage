// Per-tile look. `radius` is a fraction of the tile's shorter side, capped so
// the resize handle in the corner stays reachable.
export const DEFAULT_TILE_STYLE = { rotation: 0, radius: 0, opacity: 1, shadow: true }
export const MAX_RADIUS = 0.3
export const MIN_OPACITY = 0.1

function clampNumber(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

export function normalizeStyle(style = {}) {
  return {
    rotation: clampNumber(style.rotation, -180, 180, DEFAULT_TILE_STYLE.rotation),
    radius: clampNumber(style.radius, 0, MAX_RADIUS, DEFAULT_TILE_STYLE.radius),
    opacity: clampNumber(style.opacity, MIN_OPACITY, 1, DEFAULT_TILE_STYLE.opacity),
    shadow: style.shadow === undefined ? DEFAULT_TILE_STYLE.shadow : Boolean(style.shadow),
  }
}

export function radiusPx(style, width, height) {
  return style.radius * Math.min(width, height)
}
