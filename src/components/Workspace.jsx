import { useEffect, useRef, useState } from 'react'
import VideoTile from './VideoTile.jsx'

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

// Converts a video's stored width and 0–1 position into pixels, shrinking it
// (without changing its aspect ratio) if it would not fit the workspace.
function getTileRect(video, workspace) {
  const width = Math.max(
    0,
    Math.min(video.width, workspace.width, workspace.height * video.aspectRatio),
  )
  const height = width / video.aspectRatio
  const maxLeft = Math.max(0, workspace.width - width)
  const maxTop = Math.max(0, workspace.height - height)
  return {
    width,
    left: video.x * maxLeft,
    top: video.y * maxTop,
    maxLeft,
    maxTop,
  }
}

function Workspace({
  videos,
  showPlaceholder,
  background,
  onVideoMetadata,
  onVideoMove,
  onVideoBringToFront,
}) {
  const ref = useRef(null)
  const size = useElementSize(ref)

  const style = background
    ? { backgroundImage: `url("${background.url}")` }
    : undefined

  return (
    <main className="workspace" style={style} ref={ref}>
      {showPlaceholder && (
        <p className="workspace__empty">
          Upload videos from the panel to start your collage.
        </p>
      )}
      {size.width > 0 &&
        videos.map((video) => (
          <VideoTile
            key={video.id}
            video={video}
            rect={getTileRect(video, size)}
            onMetadata={onVideoMetadata}
            onMove={onVideoMove}
            onBringToFront={onVideoBringToFront}
          />
        ))}
    </main>
  )
}

export default Workspace
