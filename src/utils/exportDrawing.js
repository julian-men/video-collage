import { radiusPx } from './tileStyle.js'

// Canvas drawing for exports, matching the workspace's CSS.

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
export function drawDefaultScene(ctx, width, height) {
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
export function drawCoverImage(ctx, image, width, height) {
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

function tilePath(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  if (radius > 0 && typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius)
  } else {
    ctx.rect(x, y, width, height)
  }
}

// Media fitted inside the tile like CSS `object-fit: contain`, or null while
// it has no frame to draw.
function containRect(media, width, height) {
  const isVideo = media instanceof HTMLVideoElement
  const naturalWidth = isVideo ? media.videoWidth : media.naturalWidth
  const naturalHeight = isVideo ? media.videoHeight : media.naturalHeight
  const ready = isVideo
    ? media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    : media.complete
  if (!ready || !naturalWidth || !naturalHeight) return null
  const scale = Math.min(width / naturalWidth, height / naturalHeight)
  const drawWidth = naturalWidth * scale
  const drawHeight = naturalHeight * scale
  return {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  }
}

// Shadows from App.css `--shadow-soft`. Each is cast by a copy of the tile
// moved far off-canvas, so only the shadow lands and the tile's own opacity
// isn't applied twice.
const TILE_SHADOWS = [
  { blur: 30, offsetY: 10, color: 'rgba(6, 70, 130, 0.25)' },
  { blur: 6, offsetY: 2, color: 'rgba(6, 70, 130, 0.15)' },
]
const SHADOW_SHIFT = 100000

/**
 * Draws one tile like its CSS: rotated about its centre, with rounded corners,
 * opacity, and shadow, on a black background where the media doesn't reach.
 */
export function drawTile(ctx, tile) {
  const { style, width, height } = tile
  const x = -width / 2
  const y = -height / 2
  const radius = radiusPx(style, width, height)
  ctx.save()
  ctx.translate(tile.x + width / 2, tile.y + height / 2)
  ctx.rotate((style.rotation * Math.PI) / 180)
  ctx.globalAlpha = style.opacity
  if (style.shadow) {
    // Shadow offsets are in canvas pixels and ignore the transform, so the
    // shape is moved off-canvas by a canvas-pixel vector mapped back through it.
    const transform = ctx.getTransform()
    const inverse = transform.inverse()
    const scale = Math.hypot(transform.a, transform.b) || 1
    for (const shadow of TILE_SHADOWS) {
      ctx.save()
      ctx.translate(-SHADOW_SHIFT * inverse.a, -SHADOW_SHIFT * inverse.b)
      ctx.shadowColor = shadow.color
      ctx.shadowBlur = shadow.blur * scale
      ctx.shadowOffsetX = SHADOW_SHIFT
      ctx.shadowOffsetY = shadow.offsetY * scale
      tilePath(ctx, x, y, width, height, radius)
      ctx.fillStyle = '#000'
      ctx.fill()
      ctx.restore()
    }
  }
  tilePath(ctx, x, y, width, height, radius)
  ctx.clip()
  const fit = containRect(tile.media, width, height)
  ctx.fillStyle = '#000'
  if (!fit) {
    ctx.fillRect(x, y, width, height)
  } else {
    // Black only where the media doesn't cover, so opacity applies once.
    ctx.beginPath()
    ctx.rect(x, y, width, height)
    ctx.rect(x + fit.x, y + fit.y, fit.width, fit.height)
    ctx.fill('evenodd')
    ctx.drawImage(tile.media, x + fit.x, y + fit.y, fit.width, fit.height)
  }
  ctx.restore()
}
