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
  onDropFiles,
}) {
  const ref = useRef(null)
  const size = useElementSize(ref)
  const [isDropTarget, setIsDropTarget] = useState(false)

  function carriesFiles(event) {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files')
  }

  function handleDragOver(event) {
    if (!carriesFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDropTarget(true)
  }

  function handleDragLeave(event) {
    // Leaving for a child tile still counts as being over the workspace.
    if (!event.currentTarget.contains(event.relatedTarget)) setIsDropTarget(false)
  }

  function handleDrop(event) {
    if (!carriesFiles(event)) return
    event.preventDefault()
    setIsDropTarget(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onDropFiles(files)
  }

  const style = background
    ? { backgroundImage: `url("${background.url}")` }
    : undefined

  return (
    <main
      className={`workspace${isDropTarget ? ' workspace--drop' : ''}`}
      style={style}
      ref={ref}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showPlaceholder && (
        <p className="workspace__empty">
          Upload or drop videos, images, or a soundtrack here to start your collage.
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
