import { useRef, useState } from 'react'
import { NO_VIDEO_PICTURE_MESSAGE, describeLoadError } from '../utils/mediaFiles.js'

const MIN_RESIZE_WIDTH = 80

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function MediaTile({
  item,
  rect,
  onAspectRatio,
  onMove,
  onResize,
  onBringToFront,
  onRemove,
  onLoadError,
}) {
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  function reportAspectRatio(width, height) {
    if (width > 0 && height > 0) onAspectRatio(item.id, width / height)
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest('button, .media-tile__resize')) return
    event.preventDefault()
    onBringToFront(item.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    }
    setIsDragging(true)
  }

  function handlePointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const left = clamp(drag.startLeft + event.clientX - drag.startX, 0, rect.maxLeft)
    const top = clamp(drag.startTop + event.clientY - drag.startY, 0, rect.maxTop)
    onMove(
      item.id,
      rect.maxLeft > 0 ? left / rect.maxLeft : item.x,
      rect.maxTop > 0 ? top / rect.maxTop : item.y,
    )
  }

  function handlePointerEnd(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsDragging(false)
  }

  function handleResizeStart(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onBringToFront(item.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startLeft: rect.left,
      startTop: rect.top,
    }
    setIsResizing(true)
  }

  // Only the width is stored; the height always follows the aspect ratio. The
  // top-left corner stays put unless the minimum size forces it inward.
  function handleResizeMove(event) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    event.stopPropagation()

    const aspect = item.aspectRatio
    const { workspaceWidth, workspaceHeight } = rect
    const startHeight = resize.startWidth / aspect
    const proposed = Math.max(
      resize.startWidth + event.clientX - resize.startX,
      (startHeight + event.clientY - resize.startY) * aspect,
    )
    const fitWidth = Math.min(workspaceWidth, workspaceHeight * aspect)
    const minWidth = Math.min(MIN_RESIZE_WIDTH, fitWidth)
    const maxWidth = Math.min(
      workspaceWidth - resize.startLeft,
      (workspaceHeight - resize.startTop) * aspect,
    )
    const width = clamp(proposed, minWidth, Math.max(maxWidth, minWidth))
    const height = width / aspect
    const maxLeft = Math.max(0, workspaceWidth - width)
    const maxTop = Math.max(0, workspaceHeight - height)
    const left = Math.min(resize.startLeft, maxLeft)
    const top = Math.min(resize.startTop, maxTop)
    onResize(
      item.id,
      width,
      maxLeft > 0 ? left / maxLeft : 0,
      maxTop > 0 ? top / maxTop : 0,
    )
  }

  function handleResizeEnd(event) {
    if (resizeRef.current?.pointerId !== event.pointerId) return
    event.stopPropagation()
    resizeRef.current = null
    setIsResizing(false)
  }

  const mediaStyle = { aspectRatio: item.aspectRatio }

  return (
    <figure
      className={`media-tile${isDragging ? ' media-tile--dragging' : ''}${
        isResizing ? ' media-tile--resizing' : ''
      }`}
      style={{
        width: rect.width,
        left: rect.left,
        top: rect.top,
        zIndex: item.zIndex,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {item.loadError ? (
        <div
          className="media-tile__failed"
          style={mediaStyle}
          role="img"
          aria-label={`${item.name} could not be displayed`}
        >
          <span className="media-tile__failed-icon" aria-hidden="true">
            !
          </span>
          <span>Can't display this file</span>
        </div>
      ) : item.type === 'video' ? (
        <video
          className="media-tile__media"
          src={item.url}
          style={mediaStyle}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget
            if (videoWidth === 0 || videoHeight === 0) {
              onLoadError(item.id, NO_VIDEO_PICTURE_MESSAGE)
            } else {
              reportAspectRatio(videoWidth, videoHeight)
            }
          }}
          onError={(event) =>
            onLoadError(
              item.id,
              describeLoadError('video', event.currentTarget.error?.code),
            )
          }
        />
      ) : (
        <img
          className="media-tile__media"
          src={item.url}
          alt={item.name}
          style={mediaStyle}
          draggable={false}
          onLoad={(event) =>
            reportAspectRatio(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
            )
          }
          onError={() => onLoadError(item.id, describeLoadError('image'))}
        />
      )}
      <figcaption className="media-tile__caption">{item.name}</figcaption>
      <button
        type="button"
        className="media-tile__remove"
        aria-label={`Remove ${item.name}`}
        title={`Remove ${item.name}`}
        onClick={() => onRemove(item.id)}
      >
        ×
      </button>
      <span
        className="media-tile__resize"
        aria-hidden="true"
        title={`Resize ${item.name}`}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      />
    </figure>
  )
}

export default MediaTile
