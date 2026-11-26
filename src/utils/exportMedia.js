import { ExportError } from './exportSettings.js'
import { getTileRect } from './tileLayout.js'
import { normalizeStyle } from './tileStyle.js'

// Loading the media an export draws, and the async helpers that keep every
// wait cancellable and bounded.

const IMAGE_TIMEOUT_MS = 5000

export function cancelledError() {
  return new ExportError('Export was cancelled.')
}

export function withTimeout(promise, ms, message) {
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ExportError(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export function abortable(promise, signal) {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(cancelledError())
  let onAbort = null
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(cancelledError())
    signal.addEventListener('abort', onAbort, { once: true })
  })
  return Promise.race([promise, aborted]).finally(() =>
    signal.removeEventListener('abort', onAbort),
  )
}

export function releaseMedia(element) {
  if (element instanceof HTMLVideoElement) {
    element.onloadeddata = null
    element.onerror = null
    element.pause()
    element.removeAttribute('src')
    element.load()
  } else {
    element.onload = null
    element.onerror = null
    element.removeAttribute('src')
  }
}

export function loadImage(url, message = 'The background image could not be loaded.') {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const fail = () => {
      clearTimeout(timer)
      reject(new ExportError(message))
    }
    const timer = setTimeout(fail, IMAGE_TIMEOUT_MS)
    image.onload = () => {
      clearTimeout(timer)
      resolve(image)
    }
    image.onerror = fail
    image.src = url
  })
}

// The live tile elements for the visible items, placed from each item's saved
// position and style. Videos keep playing from where they are on screen.
export function liveTiles(items, workspace, workspaceSize) {
  return items
    .map((item, index) => {
      if (item.loadError) return null
      const tile = [...workspace.querySelectorAll('.media-tile')].find(
        (element) => element.dataset.itemId === item.id,
      )
      const media = tile?.querySelector('.media-tile__media')
      if (!media) return null
      return placeTile(item, index, media, workspaceSize)
    })
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex)
}

function placeTile(item, index, media, workspaceSize) {
  const rect = getTileRect(item, workspaceSize)
  return {
    index,
    media,
    zIndex: item.zIndex,
    style: normalizeStyle(item.style),
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.width / item.aspectRatio,
  }
}

function loadRevealMedia(item, created) {
  return new Promise((resolve, reject) => {
    const isVideo = item.type === 'video'
    const element = isVideo ? document.createElement('video') : new Image()
    created.push(element)
    const fail = () => {
      clearTimeout(timer)
      reject(new ExportError(`“${item.name}” could not be loaded for export.`))
    }
    const timer = setTimeout(fail, IMAGE_TIMEOUT_MS)
    const ready = () => {
      clearTimeout(timer)
      resolve(element)
    }
    element.onerror = fail
    if (isVideo) {
      element.muted = true
      element.loop = true
      element.playsInline = true
      element.preload = 'auto'
      // Wait until a frame can be drawn, not only until metadata arrives.
      element.onloadeddata = () => {
        if (element.videoWidth > 0) ready()
        else element.addEventListener('seeked', ready, { once: true })
      }
    } else {
      element.onload = ready
    }
    element.src = item.url
  })
}

/**
 * Separate media elements for every item in upload order, placed from each
 * item's saved position, width, aspect ratio, and z-index, so hidden items can
 * be recorded and the live tiles are never touched. Failed items keep their
 * place in the reveal order but draw nothing, like the full-collage export.
 */
export async function loadRevealTiles(items, workspaceSize, created, signal) {
  const tiles = await abortable(
    Promise.all(
      items.map(async (item, index) => {
        if (item.loadError) return null
        const media = await loadRevealMedia(item, created)
        return placeTile(item, index, media, workspaceSize)
      }),
    ),
    signal,
  )
  return tiles.filter(Boolean).sort((a, b) => a.zIndex - b.zIndex)
}
