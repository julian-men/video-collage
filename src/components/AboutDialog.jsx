import { useEffect, useRef } from 'react'
import { APP_NAME, CREDIT_NAME } from '../appInfo.js'

function AboutDialog({ onClose }) {
  const closeRef = useRef(null)

  // Move focus into the dialog, and hand it back to whatever opened it.
  useEffect(() => {
    const previouslyFocused = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  return (
    <div
      className="about-dialog"
      role="dialog"
      aria-labelledby="about-dialog-title"
      aria-describedby="about-dialog-body"
    >
      <div className="about-dialog__header">
        <h2 id="about-dialog-title" className="about-dialog__title">
          About {APP_NAME}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="shortcut-help__close"
          onClick={onClose}
          aria-label="Close About"
        >
          ×
        </button>
      </div>
      <div id="about-dialog-body" className="about-dialog__body">
        <p>
          {APP_NAME} turns your own videos and images into a collage
          all inside your browser.
        </p>
        <ul className="about-dialog__list">
          <li>Upload or drop videos and images, plus an optional background image.</li>
          <li>Arrange, resize, rotate, and style items, or randomize the whole layout. Undo any change.</li>
          <li>Reveal items in the order you choose, on a timer or in sync with a soundtrack (MP3, WAV, M4A/AAC, or OGG).</li>
          <li>Loop the soundtrack and repeat the reveal for as long as the music plays.</li>
          <li>Present the collage fullscreen with keyboard controls.</li>
          <li>Export five seconds or the full soundtrack as MP4 or WebM, in your workspace’s shape, 16:9, 9:16, or 1:1.</li>
          <li>Your collage is saved in this browser and comes back when you reopen the page.</li>
          <li>Inspired by Baby Keem and M2AF</li>
        </ul>
        <p className="about-dialog__note">
          Your files never leave this device. Nothing is uploaded to a server;
          the saved collage is kept in this browser’s own storage.
        </p>
        <p className="about-dialog__credit">Made by {CREDIT_NAME}</p>
      </div>
    </div>
  )
}

export default AboutDialog
