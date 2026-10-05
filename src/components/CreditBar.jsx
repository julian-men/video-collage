import { CREDIT_NAME } from '../appInfo.js'

function CreditBar({ isAboutOpen, onOpenAbout }) {
  return (
    <footer className="credit-bar">
      <span>Made by {CREDIT_NAME}</span>
      <span className="credit-bar__divider" aria-hidden="true">
        ·
      </span>
      <button
        type="button"
        className="credit-bar__about"
        onClick={onOpenAbout}
        aria-haspopup="dialog"
        aria-expanded={isAboutOpen}
      >
        About
      </button>
    </footer>
  )
}

export default CreditBar
