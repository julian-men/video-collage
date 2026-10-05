const SHORTCUTS = [
  ['Space', 'Start / pause reveal'],
  ['→ or N', 'Reveal next item'],
  ['R', 'Reset reveal'],
  ['L', 'Randomize layout'],
  ['Esc', 'Close dialogs / exit presentation'],
  ['?', 'Toggle this help'],
]

function ShortcutHelp({ onClose }) {
  return (
    <div className="shortcut-help" role="dialog" aria-label="Keyboard shortcuts">
      <div className="shortcut-help__header">
        <span>Keyboard shortcuts</span>
        <button
          type="button"
          className="shortcut-help__close"
          onClick={onClose}
          aria-label="Close shortcut help"
        >
          ×
        </button>
      </div>
      <dl className="shortcut-help__list">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="shortcut-help__row">
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default ShortcutHelp
