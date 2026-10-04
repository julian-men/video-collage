import { useRef, useState } from 'react'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function VideoTile({ video, rect, onMetadata, onMove, onBringToFront }) {
  const dragRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleLoadedMetadata(event) {
    const { videoWidth, videoHeight } = event.currentTarget
    if (videoWidth > 0 && videoHeight > 0) {
      onMetadata(video.id, videoWidth / videoHeight)
    }
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    onBringToFront(video.id)
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
      video.id,
      rect.maxLeft > 0 ? left / rect.maxLeft : video.x,
      rect.maxTop > 0 ? top / rect.maxTop : video.y,
    )
  }

  function handlePointerEnd(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsDragging(false)
  }

  return (
    <figure
      className={`video-tile${isDragging ? ' video-tile--dragging' : ''}`}
      style={{
        width: rect.width,
        left: rect.left,
        top: rect.top,
        zIndex: video.zIndex,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <video
        className="video-tile__video"
        src={video.url}
        style={{ aspectRatio: video.aspectRatio }}
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        onLoadedMetadata={handleLoadedMetadata}
      />
      <figcaption className="video-tile__caption">{video.name}</figcaption>
    </figure>
  )
}

export default VideoTile
