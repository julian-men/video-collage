import { useEffect, useRef, useState } from 'react'
import AboutDialog from './components/AboutDialog.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import CreditBar from './components/CreditBar.jsx'
import NoticeStack from './components/NoticeStack.jsx'
import ShortcutHelp from './components/ShortcutHelp.jsx'
import Workspace from './components/Workspace.jsx'
import useCollageExport from './hooks/useCollageExport.js'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js'
import useMediaItems from './hooks/useMediaItems.js'
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
} from './utils/mediaFiles.js'
import { isSoundtrackFile } from './utils/audioFiles.js'
import { itemsShownBefore } from './utils/revealTimeline.js'
import './App.css'

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

function App() {
  const media = useMediaItems({
    onLoadFailed: (item, message) => noticeItemFailed(item.id, item.name, message),
  })
  const { items } = media
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

  // Background image URLs, revoked when the app unmounts. Collage item URLs
  // belong to useMediaItems.
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

  function pushNotice(fields) {
    const notice = createNotice(fields)
    setNotices((current) => [...current, notice].slice(-MAX_NOTICES))
  }

  function dismissNotice(id) {
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }

  function noticeItemFailed(id, name, message) {
    const notice = createNotice({
      kind: 'error',
      title: `Couldn't display “${name}”`,
      message,
      itemId: id,
    })
    setNotices((current) =>
      current.some((existing) => existing.itemId === id)
        ? current
        : [...current, notice].slice(-MAX_NOTICES),
    )
  }

  function handleAddMedia(files) {
    const rejected = media.add(files)
    if (rejected.length === 0) return
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

  // Dropped audio becomes the soundtrack; everything else goes to the collage.
  function handleDropFiles(files) {
    const audio = files.filter(isSoundtrackFile)
    const media = files.filter((file) => !isSoundtrackFile(file))
    if (audio.length > 0) soundtrack.load(audio[0])
    if (media.length > 0) handleAddMedia(media)
  }

  function handleItemLoadError(id, message) {
    const item = items.find((candidate) => candidate.id === id)
    if (!item || item.loadError) return
    media.markFailed(id, message)
    noticeItemFailed(id, item.name, message)
  }

  function handleRemove(id) {
    const index = media.remove(id)
    if (index === -1) return
    setNotices((current) => current.filter((notice) => notice.itemId !== id))
    reveal.handleRemoved(index)
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
    backgroundRequest.current += 1
    if (background) revoke(background.url)
    media.clear()
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
      media.randomize()
    },
    'mod+z': () => media.undo(),
    'mod+shift+z': () => media.redo(),
    'mod+y': () => media.redo(),
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
        onItemAspectRatio={media.setAspectRatio}
        onItemGestureStart={media.beginGesture}
        onItemMove={media.move}
        onItemResize={media.resize}
        onItemBringToFront={media.bringToFront}
        onItemRemove={handleRemove}
        onItemLoadError={handleItemLoadError}
        onDropFiles={handleDropFiles}
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
          items={items}
          onReorder={media.reorder}
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
          onRandomizeLayout={media.randomize}
          canUndo={media.canUndo}
          canRedo={media.canRedo}
          onUndo={media.undo}
          onRedo={media.redo}
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
