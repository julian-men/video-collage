import { useEffect, useRef, useState } from 'react'
import ControlPanel from './components/ControlPanel.jsx'
import Workspace from './components/Workspace.jsx'
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

function App() {
  const [videos, setVideos] = useState([])
  const [background, setBackground] = useState(null)

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
    setVideos((current) => [...current, ...newVideos])
  }

  function handleVideoMetadata(id, aspectRatio) {
    setVideos((current) =>
      current.map((video) =>
        video.id === id ? { ...video, aspectRatio } : video,
      ),
    )
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
  }

  return (
    <div className="app">
      <Workspace
        videos={videos}
        background={background}
        onVideoMetadata={handleVideoMetadata}
      />
      <ControlPanel
        videoCount={videos.length}
        hasBackground={background !== null}
        onAddVideos={handleAddVideos}
        onSetBackground={handleSetBackground}
        onRandomizeLayout={handleRandomizeLayout}
        onClearAll={handleClearAll}
      />
    </div>
  )
}

export default App
