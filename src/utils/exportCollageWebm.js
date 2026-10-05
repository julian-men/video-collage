import { EXPORT_FILE_NAME } from '../appInfo.js'

const DURATION_MS = 5000
const STOP_TIMEOUT_MS = 3000
const IMAGE_TIMEOUT_MS = 5000
const FRAME_RATE = 30
const MAX_WIDTH = 1280
const MAX_HEIGHT = 720
const VIDEO_BITS_PER_SECOND = 8_000_000
const MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]
export class ExportError extends Error {}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const fail = () => {
      clearTimeout(timer)
      reject(new ExportError('The background image could not be loaded.'))
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

// Snapshot of every rendered tile so later drags or resizes don't affect the
// recording. Coordinates are in workspace CSS pixels.
function measureTiles(workspace) {
  const origin = workspace.getBoundingClientRect()
  return [...workspace.querySelectorAll('.media-tile')]
    .map((tile) => {
      const media = tile.querySelector('.media-tile__media')
      const rect = media.getBoundingClientRect()
      return {
        media,
        zIndex: Number(tile.style.zIndex) || 0,
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      }
    })
    .sort((a, b) => a.zIndex - b.zIndex)
}

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

function fillSoftEllipse(ctx, cx, cy, rx, ry, alpha) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(rx, ry)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function fillBubble(ctx, x, y, size) {
  const r = size / 2
  const gradient = ctx.createRadialGradient(
    x + size * 0.35,
    y + size * 0.3,
    0,
    x + r,
    y + r,
    r,
  )
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)')
  gradient.addColorStop(0.85, 'rgba(160, 225, 255, 0.12)')
  gradient.addColorStop(0.95, 'rgba(255, 255, 255, 0.6)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2)
  ctx.fill()
}

// Canvas approximation of the CSS sky, clouds, bubbles, and hills in App.css.
function drawDefaultScene(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, cssColor('--sky-top', '#2fa9ec'))
  sky.addColorStop(0.42, cssColor('--sky-mid', '#8fd6ff'))
  sky.addColorStop(0.72, cssColor('--sky-low', '#dcf5ff'))
  sky.addColorStop(1, cssColor('--meadow', '#b9eb9a'))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  // The CSS cloud layer spans -10%..110% horizontally and -5%..60% vertically.
  const boxX = -0.1 * width
  const boxY = -0.05 * height
  const boxW = 1.2 * width
  const boxH = 0.65 * height
  const clouds = [
    [14, 7, 18, 22, 0.95],
    [9, 6, 24, 18, 0.9],
    [18, 8, 62, 30, 0.85],
    [10, 6, 68, 25, 0.9],
    [12, 5, 88, 14, 0.8],
    [60, 40, 50, -10, 0.45],
  ]
  for (const [rx, ry, cx, cy, alpha] of clouds) {
    fillSoftEllipse(
      ctx,
      boxX + (cx / 100) * boxW,
      boxY + (cy / 100) * boxH,
      (rx / 100) * boxW,
      (ry / 100) * boxH,
      alpha,
    )
  }

  const hills = [
    [50, 112, 70, 18, '#9be36a'],
    [85, 112, 60, 26, '#5fc23a'],
    [20, 108, 55, 22, '#7fd650'],
  ]
  for (const [cx, cy, rx, ry, color] of hills) {
    fillEllipse(
      ctx,
      (cx / 100) * width,
      (cy / 100) * height,
      (rx / 100) * width * 0.6,
      (ry / 100) * height * 0.6,
      color,
    )
  }

  const bubbles = [
    [84, 42, 110],
    [92, 60, 60],
    [58, 68, 44],
    [40, 52, 26],
  ]
  for (const [px, py, size] of bubbles) {
    fillBubble(
      ctx,
      (px / 100) * (width - size),
      (py / 100) * (height - size),
      size,
    )
  }
}

// Matches CSS `background-size: cover; background-position: center`.
function drawCoverImage(ctx, image, width, height) {
  ctx.fillStyle = cssColor('--sky-mid', '#8fd6ff')
  ctx.fillRect(0, 0, width, height)
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  ctx.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
}

function drawTiles(ctx, tiles) {
  for (const tile of tiles) {
    const { media } = tile
    const ready =
      media instanceof HTMLVideoElement
        ? media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        : media.complete && media.naturalWidth > 0
    ctx.fillStyle = '#000'
    ctx.fillRect(tile.x, tile.y, tile.width, tile.height)
    if (ready) ctx.drawImage(media, tile.x, tile.y, tile.width, tile.height)
  }
}

function evenSize(value) {
  return Math.max(2, Math.round(value / 2) * 2)
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = EXPORT_FILE_NAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportCollageWebm({ workspace, background }) {
  const mimeType = pickMimeType()
  const canvas = document.createElement('canvas')
  if (!mimeType || typeof canvas.captureStream !== 'function') {
    throw new ExportError(
      'This browser cannot record WebM video. Try a recent version of Chrome, Edge, or Firefox.',
    )
  }
  if (!workspace) throw new ExportError('The collage workspace is not available.')

  const tiles = measureTiles(workspace)
  if (tiles.length === 0) throw new ExportError('There is no media to export.')

  const { width: workspaceWidth, height: workspaceHeight } =
    workspace.getBoundingClientRect()
  const scale = Math.min(1, MAX_WIDTH / workspaceWidth, MAX_HEIGHT / workspaceHeight)
  canvas.width = evenSize(workspaceWidth * scale)
  canvas.height = evenSize(workspaceHeight * scale)

  const backgroundImage = background ? await loadImage(background.url) : null

  const ctx = canvas.getContext('2d')
  function drawFrame() {
    ctx.setTransform(
      canvas.width / workspaceWidth,
      0,
      0,
      canvas.height / workspaceHeight,
      0,
      0,
    )
    if (backgroundImage) {
      drawCoverImage(ctx, backgroundImage, workspaceWidth, workspaceHeight)
    } else {
      drawDefaultScene(ctx, workspaceWidth, workspaceHeight)
    }
    drawTiles(ctx, tiles)
  }

  let isDone = false
  let frameId = null
  let durationTimer = null
  let stopTimer = null
  let stream = null
  let recorder = null
  try {
    drawFrame()
    stream = canvas.captureStream(FRAME_RATE)
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    })
    const activeRecorder = recorder

    const chunks = []
    activeRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    // Every way the recording can end funnels through this one promise, so it
    // always settles: normal stop, recorder error, draw error, or stop timeout.
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        if (isDone) return
        isDone = true
        if (error) reject(error)
        else resolve()
      }

      activeRecorder.onstop = () => finish()
      activeRecorder.onerror = (event) =>
        finish(event.error ?? new ExportError('Recording failed.'))

      function loop() {
        if (isDone) return
        try {
          drawFrame()
        } catch {
          finish(new ExportError('A media item could not be drawn.'))
          return
        }
        frameId = requestAnimationFrame(loop)
      }

      activeRecorder.start(250)
      frameId = requestAnimationFrame(loop)
      durationTimer = setTimeout(() => {
        try {
          if (activeRecorder.state !== 'inactive') activeRecorder.stop()
        } catch {
          finish(new ExportError('Recording could not be stopped.'))
          return
        }
        stopTimer = setTimeout(
          () => finish(new ExportError('Recording did not finish. Please try again.')),
          STOP_TIMEOUT_MS,
        )
      }, DURATION_MS)
    })

    if (chunks.length === 0) throw new ExportError('The recording came out empty.')
    downloadBlob(new Blob(chunks, { type: 'video/webm' }))
  } finally {
    isDone = true
    clearTimeout(durationTimer)
    clearTimeout(stopTimer)
    if (frameId !== null) cancelAnimationFrame(frameId)
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        // Already stopped by the browser; nothing left to release.
      }
    }
    stream?.getTracks().forEach((track) => track.stop())
    canvas.width = 0
    canvas.height = 0
  }
}
