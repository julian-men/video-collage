import { APP_NAME } from '../appInfo.js'
import {
  EXPORT_FORMATS,
  EXPORT_QUALITIES,
  SHORT_EXPORT_SECONDS,
  estimateExportBytes,
} from '../utils/exportCollageVideo.js'
import { formatTime } from '../utils/formatTime.js'
import RevealControls from './RevealControls.jsx'
import SoundtrackControls from './SoundtrackControls.jsx'

const RECOMMEND_STANDARD_SECONDS = 60
const LONG_EXPORT_SECONDS = 5 * 60
const LARGE_EXPORT_BYTES = 250_000_000

function formatMegabytes(bytes) {
  const megabytes = bytes / 1_000_000
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`
}

function ControlPanel({
  itemCount,
  hasBackground,
  reveal,
  sync,
  syncEnabled,
  visibleCount,
  onToggleSync,
  soundtrack,
  onLoadSoundtrack,
  onRemoveSoundtrack,
  mediaAccept,
  onAddMedia,
  onSetBackground,
  onRandomizeLayout,
  onEnterPresentation,
  exportQuality,
  onExportQualityChange,
  exportFormat,
  exportSupport,
  exportMode,
  exportBlockedByRepeat,
  onExportFormatChange,
  exportLength,
  onExportLengthChange,
  fullLengthAvailable,
  soundtrackDuration,
  fullExportCoverage,
  isExporting,
  exportProgress,
  exportCancelled,
  exportError,
  onExport,
  onCancelExport,
  onClearAll,
}) {
  function handleMediaChange(event) {
    onAddMedia(Array.from(event.target.files))
    // Reset so selecting the same file again still fires a change event.
    event.target.value = ''
  }

  function handleBackgroundChange(event) {
    onSetBackground(event.target.files[0])
    event.target.value = ''
  }

  const hasSoundtrack = soundtrack.track !== null || soundtrack.pendingName !== null
  const isEmpty = itemCount === 0 && !hasBackground && !hasSoundtrack

  const quality = EXPORT_QUALITIES[exportQuality]
  const qualitySummary = `${quality.label}: up to ${quality.maxWidth}×${quality.maxHeight}, ${
    quality.videoBitsPerSecond / 1_000_000
  } Mbps`
  const format = EXPORT_FORMATS[exportFormat]
  // A music-synchronized reveal needs a container that can also hold audio.
  const withAudio = exportMode === 'sync'
  const canUse = (id) => (withAudio ? exportSupport[`${id}Audio`] : exportSupport[id])
  const formatUsable = canUse(exportFormat)
  let formatNote
  if (withAudio && !canUse('mp4') && !canUse('webm')) {
    formatNote =
      "This browser can't record video with soundtrack audio, so the synchronized reveal can't be exported here."
  } else if (withAudio && exportSupport.mp4 && !exportSupport.mp4Audio) {
    formatNote =
      exportFormat === 'mp4'
        ? "MP4 can't include the soundtrack in this browser. Select WebM to export the synchronized reveal."
        : "WebM includes the soundtrack. MP4 can't include it in this browser."
  } else if (withAudio && exportSupport.webm && !exportSupport.webmAudio) {
    formatNote =
      exportFormat === 'webm'
        ? "WebM can't include the soundtrack in this browser. Select MP4 to export the synchronized reveal."
        : "MP4 includes the soundtrack. WebM can't include it in this browser."
  } else if (!exportSupport.mp4 && !exportSupport.webm) {
    formatNote = "This browser can't record MP4 or WebM video, so export isn't available here."
  } else if (!exportSupport.mp4) {
    formatNote = "MP4 is unavailable because this browser can't record it. Exports use WebM."
  } else if (!exportSupport.webm) {
    formatNote = "WebM is unavailable because this browser can't record it. Exports use MP4."
  } else if (exportFormat === 'mp4') {
    formatNote = withAudio
      ? 'MP4 (H.264 with AAC audio) plays on most phones and in most apps.'
      : 'MP4 (H.264) plays on most phones and in most apps.'
  } else {
    formatNote = withAudio
      ? 'WebM (VP9 or VP8 with Opus audio) plays in most desktop browsers.'
      : 'WebM (VP9 or VP8) plays in most desktop browsers.'
  }

  const isFull = exportLength === 'full'
  const songLength = formatTime(soundtrackDuration)
  let exportSummary = '5 seconds · silent'
  if (exportMode === 'interval') exportSummary = '5-second reveal sequence · silent'
  else if (isFull) {
    exportSummary = `${songLength} ${
      reveal.repeat ? 'repeating reveal' : 'reveal sequence'
    } · full soundtrack included`
  } else if (exportMode === 'sync') {
    exportSummary = '5-second reveal sequence · soundtrack included'
  }

  let repeatMessage = 'Turn off Repeat reveal to export the reveal sequence.'
  if (exportMode === 'interval') {
    repeatMessage =
      'A repeating timer reveal never ends, so it can’t be exported. Turn off Repeat reveal to export the reveal sequence.'
  } else if (fullLengthAvailable) {
    repeatMessage =
      'To export a repeating reveal, choose Full soundtrack under Export length, or turn off Repeat reveal.'
  }

  // Everything below is only shown for a full-soundtrack export.
  const estimatedBytes = estimateExportBytes(exportQuality, soundtrackDuration, true)
  const standardBytes = estimateExportBytes('standard', soundtrackDuration, true)
  const isLongExport =
    soundtrackDuration > LONG_EXPORT_SECONDS || estimatedBytes > LARGE_EXPORT_BYTES
  let coverageNote = null
  let coverageIsWarning = false
  if (isFull && fullExportCoverage !== null && itemCount > 0) {
    if (fullExportCoverage >= itemCount) {
      coverageNote = `Every item appears at least once before the song ends.`
    } else {
      coverageIsWarning = true
      const shown =
        fullExportCoverage === 0
          ? 'No items can appear'
          : `Only ${fullExportCoverage} of ${itemCount} items can appear`
      coverageNote =
        sync.beatsPerReveal > 1
          ? `${shown} before the song ends at one reveal every ${sync.beatsPerReveal} beats. Choose fewer beats under Reveal every to show them all.`
          : `${shown} before the song ends, even at one reveal per beat. Use a longer soundtrack or fewer items to show them all.`
    }
  }

  const lengthLabel = isFull ? songLength : `${SHORT_EXPORT_SECONDS}-second`
  let exportHint = `Record a ${lengthLabel} ${format.label} of the ${
    exportMode === 'collage' ? 'collage' : 'reveal sequence'
  } (${qualitySummary})`
  if (itemCount === 0) exportHint = 'Add media to export'
  else if (exportBlockedByRepeat) exportHint = repeatMessage
  else if (!formatUsable) exportHint = formatNote

  let exportLabel = `Export ${format.label}`
  if (isExporting && exportProgress) {
    const percent = Math.min(
      100,
      Math.floor((exportProgress.elapsed / exportProgress.duration) * 100),
    )
    exportLabel = `Exporting ${format.label}… ${formatTime(exportProgress.elapsed)} / ${formatTime(
      exportProgress.duration,
    )} (${percent}%)`
  } else if (isExporting) {
    exportLabel = `Exporting ${format.label}…`
  }

  return (
    <aside className="control-panel">
      <h1 className="control-panel__title">{APP_NAME}</h1>

      <label className="control-panel__field">
        <span>Videos &amp; images</span>
        <input
          type="file"
          accept={mediaAccept}
          multiple
          onChange={handleMediaChange}
        />
      </label>

      <label className="control-panel__field">
        <span>Background image</span>
        <input type="file" accept="image/*" onChange={handleBackgroundChange} />
      </label>

      <SoundtrackControls
        soundtrack={soundtrack}
        onLoad={onLoadSoundtrack}
        onRemove={onRemoveSoundtrack}
        onPlay={sync.start}
        onPause={sync.pause}
        onSeek={sync.seek}
      />

      <button
        type="button"
        className="control-panel__button"
        onClick={onRandomizeLayout}
        disabled={itemCount === 0}
      >
        Randomize layout
      </button>

      <RevealControls
        reveal={reveal}
        sync={sync}
        syncEnabled={syncEnabled}
        visibleCount={visibleCount}
        onToggleSync={onToggleSync}
      />

      <button
        type="button"
        className="control-panel__button control-panel__button--accent"
        onClick={onEnterPresentation}
      >
        Enter presentation mode
      </button>

      <label className="reveal-controls__interval export-quality">
        <span>Export format</span>
        <select
          value={exportFormat}
          onChange={(event) => onExportFormatChange(event.target.value)}
          disabled={isExporting}
          aria-describedby="export-format-note"
        >
          {Object.entries(EXPORT_FORMATS).map(([value, option]) => {
            let suffix = ''
            if (!exportSupport[value]) suffix = ' (not supported)'
            else if (!canUse(value)) suffix = ' (no soundtrack audio)'
            return (
              <option key={value} value={value} disabled={!canUse(value)}>
                {option.optionLabel}
                {suffix}
              </option>
            )
          })}
        </select>
      </label>
      <p id="export-format-note" className="control-panel__status" aria-live="polite">
        {formatNote}
      </p>

      <label className="reveal-controls__interval export-quality">
        <span>Export quality</span>
        <select
          value={exportQuality}
          onChange={(event) => onExportQualityChange(event.target.value)}
          disabled={isExporting}
          aria-describedby="export-quality-summary"
        >
          {Object.entries(EXPORT_QUALITIES).map(([value, preset]) => (
            <option key={value} value={value}>
              {preset.label} ({preset.maxHeight}p)
            </option>
          ))}
        </select>
      </label>
      <p id="export-quality-summary" className="control-panel__status">
        {qualitySummary} · {exportSummary}
      </p>

      {fullLengthAvailable && (
        <label className="reveal-controls__interval export-quality">
          <span>Export length</span>
          <select
            value={exportLength}
            onChange={(event) => onExportLengthChange(event.target.value)}
            disabled={isExporting}
            aria-describedby={isFull ? 'export-length-notes' : undefined}
          >
            <option value="short">{SHORT_EXPORT_SECONDS} seconds</option>
            <option value="full">Full soundtrack ({songLength})</option>
          </select>
        </label>
      )}
      {isFull && (
        <div id="export-length-notes" className="export-notes" aria-live="polite">
          <p className="control-panel__status">
            Records in real time: about {songLength}. Keep this page open until it
            finishes.
          </p>
          <p className="control-panel__status">
            Estimated size: up to about {formatMegabytes(estimatedBytes)}.
          </p>
          {exportQuality !== 'standard' &&
            (soundtrackDuration > RECOMMEND_STANDARD_SECONDS || isLongExport) && (
            <p className="control-panel__status">
              Standard quality is recommended for long exports (about{' '}
              {formatMegabytes(standardBytes)}).
            </p>
          )}
          {isLongExport && (
            <p className="control-panel__warning">
              {soundtrackDuration > LONG_EXPORT_SECONDS
                ? 'This song is longer than 5 minutes'
                : 'This file may be larger than 250 MB'}
              . Recording takes the full length of the song and the browser keeps
              the whole video in memory until it’s saved.
            </p>
          )}
          {coverageNote && (
            <p
              className={
                coverageIsWarning ? 'control-panel__warning' : 'control-panel__status'
              }
            >
              {coverageNote}
            </p>
          )}
        </div>
      )}

      {exportBlockedByRepeat && (
        <p id="export-blocked-note" className="control-panel__status">
          {repeatMessage}
        </p>
      )}

      <button
        type="button"
        className="control-panel__button"
        onClick={onExport}
        disabled={
          isExporting || itemCount === 0 || exportBlockedByRepeat || !formatUsable
        }
        title={exportHint}
        aria-busy={isExporting}
        aria-describedby={
          exportBlockedByRepeat
            ? 'export-blocked-note'
            : !formatUsable
              ? 'export-format-note'
              : undefined
        }
      >
        {exportLabel}
      </button>
      {isExporting && (
        <button
          type="button"
          className="control-panel__button control-panel__button--danger"
          onClick={onCancelExport}
        >
          Cancel export
        </button>
      )}
      {exportCancelled && !isExporting && (
        <p className="control-panel__status" role="status">
          Export cancelled. No file was saved.
        </p>
      )}

      {exportError && (
        <p className="control-panel__error" role="alert">
          {exportError}
        </p>
      )}

      <button
        type="button"
        className="control-panel__button control-panel__button--danger"
        onClick={onClearAll}
        disabled={isEmpty}
      >
        Clear all media
      </button>

      <p className="control-panel__status">
        {itemCount} media item{itemCount === 1 ? '' : 's'}
        {hasBackground ? ' · background set' : ''}
        {soundtrack.track ? ' · soundtrack set' : ''}
      </p>

      <p className="control-panel__status">
        Press <kbd>?</kbd> for keyboard shortcuts
      </p>
    </aside>
  )
}

export default ControlPanel
