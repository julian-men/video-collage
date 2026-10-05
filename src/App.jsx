import { useEffect, useRef, useState } from 'react'
import ControlPanel from './components/ControlPanel.jsx'
import ShortcutHelp from './components/ShortcutHelp.jsx'
import Workspace from './components/Workspace.jsx'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js'
import usePresentationMode from './hooks/usePresentationMode.js'
import useRevealMode from './hooks/useRevealMode.js'
import './App.css'

const MIN_VIDEO_WIDTH = 240
const MAX_VIDEO_WIDTH = 480
const DEFAULT_ASPECT_RATIO = 16 / 9

function createMediaItem(file) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: URL.createObjectURL(file),
  }
}

// Positions are stored as 0–1 fractions of the free space in the workspace, so
// a video stays fully visible no matter how large the workspace is.
function randomLayout() {
  return {
    width: MIN_VIDEO_WIDTH + Math.random() * (MAX_VIDEO_WIDTH - MIN_VIDEO_WIDTH),
    x: Math.random(),
    y: Math.random(),
  }
}

function createVideoItem(file) {
  return {
    ...createMediaItem(file),
    ...randomLayout(),
    aspectRatio: DEFAULT_ASPECT_RATIO,
  }
}

function topZIndex(videos) {
  return videos.reduce((max, video) => Math.max(max, video.zIndex), 0)
}

function App() {
  const [videos, setVideos] = useState([])
  const [background, setBackground] = useState(null)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const appRef = useRef(null)
  const presentation = usePresentationMode(appRef)
  const reveal = useRevealMode(videos.length)
  const visibleVideos = videos.slice(0, reveal.visibleCount)

  // Tracks every live object URL so they can be revoked when the app unmounts.
  const liveUrls = useRef(new Set())

  useEffect(() => {
    const urls = liveUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  function revoke(url) {
    URL.revokeObjectURL(url)
    liveUrls.current.delete(url)
  }

  function handleAddVideos(files) {
    const newVideos = files
      .filter((file) => file.type.startsWith('video/'))
      .map(createVideoItem)
    newVideos.forEach((video) => liveUrls.current.add(video.url))
    setVideos((current) => {
      const top = topZIndex(current)
      return [
        ...current,
        ...newVideos.map((video, index) => ({
          ...video,
          zIndex: top + index + 1,
        })),
      ]
    })
  }

  function handleBringToFront(id) {
    setVideos((current) => {
      const top = topZIndex(current)
      const target = current.find((video) => video.id === id)
      if (!target || target.zIndex === top) return current
      return current.map((video) =>
        video.id === id ? { ...video, zIndex: top + 1 } : video,
      )
    })
  }

  function handleVideoMetadata(id, aspectRatio) {
    setVideos((current) =>
      current.map((video) =>
        video.id === id ? { ...video, aspectRatio } : video,
      ),
    )
  }

  function handleVideoMove(id, x, y) {
    setVideos((current) =>
      current.map((video) => (video.id === id ? { ...video, x, y } : video)),
    )
  }

  function handleRemoveVideo(id) {
    const index = videos.findIndex((video) => video.id === id)
    if (index === -1) return
    revoke(videos[index].url)
    setVideos(videos.filter((video) => video.id !== id))
    reveal.handleRemoved(index)
  }

  function handleRandomizeLayout() {
    setVideos(videos.map((video) => ({ ...video, ...randomLayout() })))
  }

  function handleSetBackground(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (background) revoke(background.url)
    const next = createMediaItem(file)
    liveUrls.current.add(next.url)
    setBackground(next)
  }

  function handleClearAll() {
    videos.forEach((video) => revoke(video.url))
    if (background) revoke(background.url)
    setVideos([])
    setBackground(null)
    reveal.restoreInitial()
  }

  function handleRevealNext() {
    if (!reveal.enabled) return false
    reveal.revealNext()
  }

  // Escape is owned by usePresentationMode; here it only closes the help.
  useKeyboardShortcuts({
    ' ': () => {
      if (!reveal.enabled) return false
      reveal.toggle()
    },
    arrowright: handleRevealNext,
    n: handleRevealNext,
    r: () => {
      if (!reveal.enabled) return false
      reveal.reset()
    },
    l: () => {
      if (videos.length === 0) return false
      handleRandomizeLayout()
    },
    '?': () => setIsHelpOpen((open) => !open),
    escape: () => {
      setIsHelpOpen(false)
      return false
    },
  })

  return (
    <div
      className={`app${presentation.isPresenting ? ' app--presenting' : ''}`}
      ref={appRef}
    >
      <Workspace
        videos={visibleVideos}
        showPlaceholder={videos.length === 0}
        background={background}
        onVideoMetadata={handleVideoMetadata}
        onVideoMove={handleVideoMove}
        onVideoBringToFront={handleBringToFront}
        onVideoRemove={handleRemoveVideo}
      />
      {presentation.isPresenting ? (
        <button
          type="button"
          className="exit-presentation"
          onClick={presentation.exit}
        >
          Exit presentation mode
        </button>
      ) : (
        <ControlPanel
          videoCount={videos.length}
          hasBackground={background !== null}
          reveal={reveal}
          onAddVideos={handleAddVideos}
          onSetBackground={handleSetBackground}
          onRandomizeLayout={handleRandomizeLayout}
          onEnterPresentation={presentation.enter}
          onClearAll={handleClearAll}
        />
      )}
      {isHelpOpen && <ShortcutHelp onClose={() => setIsHelpOpen(false)} />}
    </div>
  )
}

export default App
