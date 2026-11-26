import { normalizeStyle } from './tileStyle.js'

// Bump when the saved shape changes incompatibly; older records are ignored.
export const PROJECT_VERSION = 1

const DEFAULT_WIDTH = 360
const DEFAULT_ASPECT_RATIO = 16 / 9

function finiteOr(value, fallback, isValid = () => true) {
  return typeof value === 'number' && Number.isFinite(value) && isValid(value)
    ? value
    : fallback
}

/**
 * Splits the project into a small layout record and a map of file blobs by
 * id, so frequent layout saves never rewrite large media files. Items that
 * failed to load aren't saved.
 */
export function toRecord({ items, background, soundtrack, settings }) {
  const files = new Map()
  const savedItems = items
    .filter((item) => !item.loadError && item.blob)
    .map((item) => {
      files.set(item.id, item.blob)
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        x: item.x,
        y: item.y,
        width: item.width,
        aspectRatio: item.aspectRatio,
        zIndex: item.zIndex,
        style: item.style,
      }
    })
  if (background?.blob) files.set(background.id, background.blob)
  if (soundtrack?.file) files.set(soundtrack.id, soundtrack.file)
  return {
    meta: {
      version: PROJECT_VERSION,
      items: savedItems,
      background: background?.blob ? { id: background.id, name: background.name } : null,
      soundtrack: soundtrack?.file
        ? {
            id: soundtrack.id,
            name: soundtrack.name,
            bpmInput: soundtrack.bpmInput,
            offsetInput: soundtrack.offsetInput,
          }
        : null,
      settings,
    },
    files,
  }
}

/** The saved project with blobs attached, or null if there's nothing usable. */
export function fromRecord(meta, files) {
  if (!meta || meta.version !== PROJECT_VERSION) return null
  const items = (Array.isArray(meta.items) ? meta.items : [])
    .filter((item) => item && files.has(item.id) && (item.type === 'image' || item.type === 'video'))
    .map((item, index) => ({
      id: item.id,
      name: String(item.name ?? 'Untitled'),
      type: item.type,
      x: finiteOr(item.x, 0.5, (v) => v >= 0 && v <= 1),
      y: finiteOr(item.y, 0.5, (v) => v >= 0 && v <= 1),
      width: finiteOr(item.width, DEFAULT_WIDTH, (v) => v > 0),
      aspectRatio: finiteOr(item.aspectRatio, DEFAULT_ASPECT_RATIO, (v) => v > 0),
      zIndex: finiteOr(item.zIndex, index + 1),
      style: normalizeStyle(item.style),
      blob: files.get(item.id),
    }))
  const background =
    meta.background && files.has(meta.background.id)
      ? { name: meta.background.name, blob: files.get(meta.background.id) }
      : null
  const soundtrack =
    meta.soundtrack && files.has(meta.soundtrack.id)
      ? {
          name: meta.soundtrack.name,
          blob: files.get(meta.soundtrack.id),
          bpmInput: String(meta.soundtrack.bpmInput ?? ''),
          offsetInput: String(meta.soundtrack.offsetInput ?? '0'),
        }
      : null
  return { items, background, soundtrack, settings: meta.settings ?? {} }
}
