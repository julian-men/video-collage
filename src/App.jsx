import { useEffect, useRef, useState } from 'react'
import ControlPanel from './components/ControlPanel.jsx'
import Workspace from './components/Workspace.jsx'
import './App.css'

function createMediaItem(file) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: URL.createObjectURL(file),
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
      .map(createMediaItem)
    newVideos.forEach((video) => liveUrls.current.add(video.url))
    setVideos((current) => [...current, ...newVideos])
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
      <Workspace videos={videos} background={background} />
      <ControlPanel
        videoCount={videos.length}
        hasBackground={background !== null}
        onAddVideos={handleAddVideos}
        onSetBackground={handleSetBackground}
        onClearAll={handleClearAll}
      />
    </div>
  )
}

export default App
