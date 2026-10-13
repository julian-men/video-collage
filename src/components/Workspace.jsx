import { useEffect, useRef, useState } from 'react'
import { getTileRect } from '../utils/tileLayout.js'
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

function Workspace({
  items,
  showPlaceholder,
  background,
  onItemAspectRatio,
  onItemMove,
  onItemResize,
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
            onResize={onItemResize}
            onBringToFront={onItemBringToFront}
            onRemove={onItemRemove}
            onLoadError={onItemLoadError}
          />
        ))}
    </main>
  )
}

export default Workspace
