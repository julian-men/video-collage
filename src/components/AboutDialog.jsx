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
          <li>Upload videos and images, plus an optional background image.</li>
          <li>Arrange and resize items, or randomize the whole layout.</li>
          <li>Reveal items on a timer or in sync with an MP3 soundtrack.</li>
          <li>Repeat the reveal sequence for as long as the music plays.</li>
          <li>Present the collage fullscreen with keyboard controls.</li>
          <li>Export five seconds or the full soundtrack as MP4 or WebM.</li>
          <li>Inspired by Baby Keem and M2AF</li>
        </ul>
        <p className="about-dialog__note">
          Your files never leave this device. Nothing is uploaded to a server.
        </p>
        <p className="about-dialog__credit">Made by {CREDIT_NAME}</p>
      </div>
    </div>
  )
}

export default AboutDialog
