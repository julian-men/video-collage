import { useEffect } from 'react'

const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color'])

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.closest('input, select, textarea, [contenteditable]') !== null
  )
}

// Fields with their own text undo. Sliders, checkboxes, and selects have none,
// so Ctrl/Cmd shortcuts still reach the app from them.
function isTextEntryTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('textarea, [contenteditable]')) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)
}

// Lowercase KeyboardEvent.key, prefixed with `mod+` when Ctrl or Cmd is held
// and `mod+shift+` when Shift is held too. Shift alone isn't added, since it's
// already part of keys like `?`.
function shortcutName(event) {
  const key = event.key.toLowerCase()
  if (!event.ctrlKey && !event.metaKey) return key
  return `mod+${event.shiftKey ? 'shift+' : ''}${key}`
}

// `shortcuts` maps a shortcut name (see shortcutName) to a handler. A handler
// that returns false declines the key, leaving the browser default in place.
function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.defaultPrevented || event.repeat) return
      if (event.altKey) return
      const name = shortcutName(event)
      const withMod = name.startsWith('mod+')
      if (withMod ? isTextEntryTarget(event.target) : isEditableTarget(event.target)) return
      // Space on a focused button should activate that button, not a shortcut.
      if (event.key === ' ' && event.target.closest?.('button')) return

      const handler = shortcuts[name]
      if (!handler) return
      if (handler() !== false) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export default useKeyboardShortcuts
