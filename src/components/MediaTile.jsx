import { useRef, useState } from 'react'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function MediaTile({
  item,
  rect,
  onAspectRatio,
  onMove,
  onBringToFront,
  onRemove,
}) {
  const dragRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  function reportAspectRatio(width, height) {
    if (width > 0 && height > 0) onAspectRatio(item.id, width / height)
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest('button')) return
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

  const mediaStyle = { aspectRatio: item.aspectRatio }

  return (
    <figure
      className={`media-tile${isDragging ? ' media-tile--dragging' : ''}`}
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
      {item.type === 'video' ? (
        <video
          className="media-tile__media"
          src={item.url}
          style={mediaStyle}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          onLoadedMetadata={(event) =>
            reportAspectRatio(
              event.currentTarget.videoWidth,
              event.currentTarget.videoHeight,
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
    </figure>
  )
}

export default MediaTile
