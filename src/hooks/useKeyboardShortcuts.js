import { useEffect } from 'react'

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.closest('input, select, textarea, [contenteditable]') !== null
  )
}

// `shortcuts` maps a lowercase KeyboardEvent.key to a handler. A handler that
// returns false declines the key, leaving the browser default in place.
function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.defaultPrevented || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      // Space on a focused button should activate that button, not a shortcut.
      if (event.key === ' ' && event.target.closest?.('button')) return

      const handler = shortcuts[event.key.toLowerCase()]
      if (!handler) return
      if (handler() !== false) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export default useKeyboardShortcuts
