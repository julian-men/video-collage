import { useEffect, useRef, useState } from 'react'
import AboutDialog from './components/AboutDialog.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import CreditBar from './components/CreditBar.jsx'
import NoticeStack from './components/NoticeStack.jsx'
import ShortcutHelp from './components/ShortcutHelp.jsx'
import Workspace from './components/Workspace.jsx'
import useCollageExport from './hooks/useCollageExport.js'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js'
import useMusicSync from './hooks/useMusicSync.js'
import usePresentationMode from './hooks/usePresentationMode.js'
import useRevealMode from './hooks/useRevealMode.js'
import useSoundtrack from './hooks/useSoundtrack.js'
import {
  DEFAULT_EXPORT_QUALITY,
  defaultExportFormat,
  getExportFormatSupport,
} from './utils/exportCollageVideo.js'
import {
  MEDIA_ACCEPT,
  SUPPORTED_MEDIA_DESCRIPTION,
  probeMedia,
  validateBackgroundFile,
  validateMediaFile,
} from './utils/mediaFiles.js'
import { itemsShownBefore } from './utils/revealTimeline.js'
import './App.css'

const MIN_ITEM_WIDTH = 240
const MAX_ITEM_WIDTH = 480
const DEFAULT_ASPECT_RATIO = 16 / 9
const MAX_NOTICES = 4

function createNotice(fields) {
  return { id: crypto.randomUUID(), ...fields }
}

function createObjectUrlItem(file) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: URL.createObjectURL(file),
  }
}

// Positions are stored as 0–1 fractions of the free space in the workspace, so
// an item stays fully visible no matter how large the workspace is.
function randomLayout() {
  return {
    width: MIN_ITEM_WIDTH + Math.random() * (MAX_ITEM_WIDTH - MIN_ITEM_WIDTH),
    x: Math.random(),
    y: Math.random(),
  }
}

function createMediaItem(file, type) {
  return {
    ...createObjectUrlItem(file),
    ...randomLayout(),
    type,
    aspectRatio: DEFAULT_ASPECT_RATIO,
  }
}

function topZIndex(items) {
  return items.reduce((max, item) => Math.max(max, item.zIndex), 0)
}

function App() {
  const [items, setItems] = useState([])
  const [background, setBackground] = useState(null)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [notices, setNotices] = useState([])
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [exportQuality, setExportQuality] = useState(DEFAULT_EXPORT_QUALITY)
  // Recorder support can't change during a session, so it's checked once.
  const [exportSupport] = useState(getExportFormatSupport)
  const [exportFormat, setExportFormat] = useState(() =>
    defaultExportFormat(exportSupport),
  )
  const [exportLength, setExportLength] = useState('short')

  const appRef = useRef(null)
  // Cancel functions for in-flight load checks, keyed by item id.
  const probes = useRef(new Map())
  // Bumped whenever a newer background request (or clear-all) supersedes one.
  const backgroundRequest = useRef(0)
  const backgroundRef = useRef(background)

  useEffect(() => {
    backgroundRef.current = background
  }, [background])
  const presentation = usePresentationMode(appRef)
  const soundtrack = useSoundtrack(pushNotice)
  const reveal = useRevealMode(items.length, {
    suspended:
      syncEnabled && soundtrack.track !== null && soundtrack.bpm !== null,
  })
  const sync = useMusicSync(soundtrack, {
    enabled: syncEnabled && reveal.enabled,
    totalCount: items.length,
    repeat: reveal.repeat,
  })
  const visibleCount = sync.isActive ? sync.visibleCount : reveal.visibleCount
  const visibleItems = items.slice(0, visibleCount)
  const collageExport = useCollageExport()
  // 'collage' records the tiles as shown; the reveal modes replay the sequence.
  let exportMode = 'collage'
  if (reveal.enabled) exportMode = sync.isActive ? 'sync' : 'interval'
  // Full soundtrack is only offered for a music-synchronized reveal that has
  // a decoded track and a valid BPM; everything else records five seconds.
  const fullLengthAvailable =
    reveal.enabled &&
    sync.isActive &&
    soundtrack.track !== null &&
    soundtrack.bpm !== null &&
    soundtrack.duration > 0
  const effectiveExportLength = fullLengthAvailable ? exportLength : 'short'
  const isFullExport = effectiveExportLength === 'full'
  // A repeating reveal only has a natural end when the song provides one.
  const exportBlockedByRepeat = reveal.enabled && reveal.repeat && !isFullExport
  const syncTimeline = sync.isActive
    ? {
        kind: 'beats',
        anchor: sync.anchor,
        bpm: sync.bpm,
        beatsPerReveal: sync.beatsPerReveal,
        repeat: isFullExport && reveal.repeat,
      }
    : null
  const fullExportCoverage = isFullExport
    ? itemsShownBefore(syncTimeline, soundtrack.duration, items.length)
    : null

  // Tracks every live object URL so they can be revoked when the app unmounts.
  const liveUrls = useRef(new Set())

  useEffect(() => {
    const urls = liveUrls.current
    const pendingProbes = probes.current
    return () => {
      pendingProbes.forEach((cancel) => cancel())
      pendingProbes.clear()
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  function revoke(url) {
    URL.revokeObjectURL(url)
    liveUrls.current.delete(url)
  }

  function pushNotice(fields) {
    const notice = createNotice(fields)
    setNotices((current) => [...current, notice].slice(-MAX_NOTICES))
  }

  function dismissNotice(id) {
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }

  function cancelProbe(id) {
    probes.current.get(id)?.()
    probes.current.delete(id)
  }

  function markItemFailed(id, name, message) {
    const notice = createNotice({
      kind: 'error',
      title: `Couldn't display “${name}”`,
      message,
      itemId: id,
    })
    setItems((current) =>
      current.map((item) =>
        item.id === id && !item.loadError ? { ...item, loadError: message } : item,
      ),
    )
    setNotices((current) =>
      current.some((existing) => existing.itemId === id)
        ? current
        : [...current, notice].slice(-MAX_NOTICES),
    )
  }

  // Checks every new item in a detached element, so files hidden by reveal
  // mode are verified too.
  function startProbe(item) {
    const probe = probeMedia(item.url, item.type)
    probes.current.set(item.id, probe.cancel)
    probe.promise.then((result) => {
      if (!probes.current.has(item.id)) return
      probes.current.delete(item.id)
      if (result.ok === false) markItemFailed(item.id, item.name, result.message)
    })
  }

  function handleAddMedia(files) {
    const newItems = []
    const rejected = []
    for (const file of files) {
      const result = validateMediaFile(file)
      if (result.type) newItems.push(createMediaItem(file, result.type))
      else rejected.push(`${file.name} (${result.reason})`)
    }

    if (rejected.length > 0) {
      pushNotice({
        kind: 'warning',
        title:
          rejected.length === 1
            ? '1 file was not added'
            : `${rejected.length} files were not added`,
        files: rejected,
        message: SUPPORTED_MEDIA_DESCRIPTION,
      })
    }
    if (newItems.length === 0) return

    newItems.forEach((item) => liveUrls.current.add(item.url))
    setItems((current) => {
      const top = topZIndex(current)
      return [
        ...current,
        ...newItems.map((item, index) => ({
          ...item,
          zIndex: top + index + 1,
        })),
      ]
    })
    newItems.forEach(startProbe)
  }

  function handleItemLoadError(id, message) {
    const item = items.find((candidate) => candidate.id === id)
    if (item) markItemFailed(id, item.name, message)
  }

  function handleBringToFront(id) {
    setItems((current) => {
      const top = topZIndex(current)
      const target = current.find((item) => item.id === id)
      if (!target || target.zIndex === top) return current
      return current.map((item) =>
        item.id === id ? { ...item, zIndex: top + 1 } : item,
      )
    })
  }

  function handleAspectRatio(id, aspectRatio) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, aspectRatio } : item)),
    )
  }

  function handleMove(id, x, y) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, x, y } : item)),
    )
  }

  function handleResize(id, width, x, y) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, width, x, y } : item)),
    )
  }

  function handleRemove(id) {
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) return
    cancelProbe(id)
    revoke(items[index].url)
    setItems(items.filter((item) => item.id !== id))
    setNotices((current) => current.filter((notice) => notice.itemId !== id))
    reveal.handleRemoved(index)
  }

  function handleRandomizeLayout() {
    setItems(items.map((item) => ({ ...item, ...randomLayout() })))
  }

  // The current background is only replaced once the new image has loaded,
  // so a broken file never leaves the workspace without its old background.
  async function handleSetBackground(file) {
    if (!file) return
    const problem = validateBackgroundFile(file)
    if (problem) {
      pushNotice({
        kind: 'warning',
        title: `“${file.name}” can't be used as a background`,
        message: `It was not added because ${problem}. Choose a PNG, JPG/JPEG, GIF, or WebP image.`,
      })
      return
    }

    const request = ++backgroundRequest.current
    const next = createObjectUrlItem(file)
    liveUrls.current.add(next.url)
    const result = await probeMedia(next.url, 'image').promise
    if (request !== backgroundRequest.current) {
      revoke(next.url)
      return
    }
    if (result.ok === false) {
      revoke(next.url)
      pushNotice({
        kind: 'error',
        title: `Background “${file.name}” couldn't be loaded`,
        message: `${result.message}${
          backgroundRef.current ? ' Your previous background was kept.' : ''
        }`,
      })
      return
    }
    if (backgroundRef.current) revoke(backgroundRef.current.url)
    setBackground(next)
  }

  function handleClearAll() {
    probes.current.forEach((cancel) => cancel())
    probes.current.clear()
    backgroundRequest.current += 1
    items.forEach((item) => revoke(item.url))
    if (background) revoke(background.url)
    setItems([])
    setBackground(null)
    setNotices((current) => current.filter((notice) => !notice.itemId))
    reveal.restoreInitial()
    handleRemoveSoundtrack()
  }

  function handleToggleSync(next) {
    setSyncEnabled(next)
    if (next) {
      reveal.pause()
      sync.armIfStarted()
    }
  }

  function handleRemoveSoundtrack() {
    soundtrack.remove()
    setSyncEnabled(false)
  }

  function handleExport() {
    if (items.length === 0 || exportBlockedByRepeat) return
    // Snapshot of the current settings; later changes don't affect the export.
    let revealExport = null
    if (exportMode === 'sync') {
      revealExport = {
        items,
        timeline: syncTimeline,
        soundtrackUrl: soundtrack.track.url,
      }
    } else if (exportMode === 'interval') {
      revealExport = {
        items,
        timeline: { kind: 'interval', intervalSeconds: reveal.intervalSeconds },
        soundtrackUrl: null,
      }
    }
    collageExport.exportVideo({
      workspace: appRef.current?.querySelector('.workspace'),
      background,
      quality: exportQuality,
      format: exportFormat,
      reveal: revealExport,
      length: effectiveExportLength,
    })
  }

  function handleExportFormatChange(format) {
    setExportFormat(format)
    collageExport.clearError()
  }

  function handleExportLengthChange(length) {
    setExportLength(length)
    collageExport.clearError()
  }

  // Manual advancing is off while synced so the music position alone decides
  // what is shown.
  function handleRevealNext() {
    if (!reveal.enabled || sync.isActive) return false
    reveal.revealNext()
  }

  function handleEnterPresentation() {
    setIsAboutOpen(false)
    presentation.enter()
  }

  // Escape is owned by usePresentationMode; here it only closes dialogs.
  useKeyboardShortcuts({
    ' ': () => {
      if (!reveal.enabled) return false
      if (sync.isActive) sync.toggle()
      else reveal.toggle()
    },
    arrowright: handleRevealNext,
    n: handleRevealNext,
    r: () => {
      if (!reveal.enabled) return false
      if (sync.isActive) sync.reset()
      else reveal.reset()
    },
    l: () => {
      if (items.length === 0) return false
      handleRandomizeLayout()
    },
    '?': () => setIsHelpOpen((open) => !open),
    escape: () => {
      setIsHelpOpen(false)
      setIsAboutOpen(false)
      return false
    },
  })

  return (
    <div
      className={`app${presentation.isPresenting ? ' app--presenting' : ''}`}
      ref={appRef}
    >
      <Workspace
        items={visibleItems}
        showPlaceholder={items.length === 0}
        background={background}
        onItemAspectRatio={handleAspectRatio}
        onItemMove={handleMove}
        onItemResize={handleResize}
        onItemBringToFront={handleBringToFront}
        onItemRemove={handleRemove}
        onItemLoadError={handleItemLoadError}
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
          itemCount={items.length}
          hasBackground={background !== null}
          reveal={reveal}
          sync={sync}
          syncEnabled={syncEnabled}
          visibleCount={visibleCount}
          onToggleSync={handleToggleSync}
          soundtrack={soundtrack}
          onLoadSoundtrack={soundtrack.load}
          onRemoveSoundtrack={handleRemoveSoundtrack}
          mediaAccept={MEDIA_ACCEPT}
          onAddMedia={handleAddMedia}
          onSetBackground={handleSetBackground}
          onRandomizeLayout={handleRandomizeLayout}
          onEnterPresentation={handleEnterPresentation}
          exportQuality={exportQuality}
          onExportQualityChange={setExportQuality}
          exportFormat={exportFormat}
          exportSupport={exportSupport}
          exportMode={exportMode}
          exportBlockedByRepeat={exportBlockedByRepeat}
          onExportFormatChange={handleExportFormatChange}
          exportLength={effectiveExportLength}
          onExportLengthChange={handleExportLengthChange}
          fullLengthAvailable={fullLengthAvailable}
          soundtrackDuration={soundtrack.duration}
          fullExportCoverage={fullExportCoverage}
          isExporting={collageExport.isExporting}
          exportProgress={collageExport.progress}
          exportCancelled={collageExport.wasCancelled}
          exportError={collageExport.error}
          onExport={handleExport}
          onCancelExport={collageExport.cancel}
          onClearAll={handleClearAll}
        />
      )}
      {!presentation.isPresenting && (
        <CreditBar
          isAboutOpen={isAboutOpen}
          onOpenAbout={() => setIsAboutOpen(true)}
        />
      )}
      {!presentation.isPresenting && (
        <NoticeStack
          notices={notices}
          onDismiss={dismissNotice}
          onRemoveItem={handleRemove}
        />
      )}
      {isAboutOpen && !presentation.isPresenting && (
        <AboutDialog onClose={() => setIsAboutOpen(false)} />
      )}
      {isHelpOpen && <ShortcutHelp onClose={() => setIsHelpOpen(false)} />}
    </div>
  )
}

export default App
