import { useEffect } from 'react'

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.closest('input, select, textarea, [contenteditable]') !== null
  )
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
      if (isEditableTarget(event.target)) return
      // Space on a focused button should activate that button, not a shortcut.
      if (event.key === ' ' && event.target.closest?.('button')) return

      const handler = shortcuts[shortcutName(event)]
      if (!handler) return
      if (handler() !== false) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export default useKeyboardShortcuts
