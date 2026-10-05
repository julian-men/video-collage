import { useEffect, useRef, useState } from 'react'
import MediaTile from './MediaTile.jsx'

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

// Converts an item's stored width and 0–1 position into pixels, shrinking it
// (without changing its aspect ratio) if it would not fit the workspace.
function getTileRect(item, workspace) {
  const width = Math.max(
    0,
    Math.min(item.width, workspace.width, workspace.height * item.aspectRatio),
  )
  const height = width / item.aspectRatio
  const maxLeft = Math.max(0, workspace.width - width)
  const maxTop = Math.max(0, workspace.height - height)
  return {
    width,
    left: item.x * maxLeft,
    top: item.y * maxTop,
    maxLeft,
    maxTop,
  }
}

function Workspace({
  items,
  showPlaceholder,
  background,
  onItemAspectRatio,
  onItemMove,
  onItemBringToFront,
  onItemRemove,
  onItemLoadError,
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
          Upload videos or images from the panel to start your collage.
        </p>
      )}
      {size.width > 0 &&
        items.map((item) => (
          <MediaTile
            key={item.id}
            item={item}
            rect={getTileRect(item, size)}
            onAspectRatio={onItemAspectRatio}
            onMove={onItemMove}
            onBringToFront={onItemBringToFront}
            onRemove={onItemRemove}
            onLoadError={onItemLoadError}
          />
        ))}
    </main>
  )
}

export default Workspace
