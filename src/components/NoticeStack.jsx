const MAX_LISTED_FILES = 8

function NoticeStack({ notices, onDismiss, onRemoveItem }) {
  if (notices.length === 0) return null

  return (
    <div className="notice-stack">
      {notices.map((notice) => {
        const listed = notice.files?.slice(0, MAX_LISTED_FILES) ?? []
        const hidden = (notice.files?.length ?? 0) - listed.length
        return (
          <div
            key={notice.id}
            className={`notice notice--${notice.kind}`}
            role="alert"
          >
            <div className="notice__header">
              <span className="notice__title">{notice.title}</span>
              <button
                type="button"
                className="shortcut-help__close"
                onClick={() => onDismiss(notice.id)}
                aria-label={`Dismiss: ${notice.title}`}
              >
                ×
              </button>
            </div>
            {listed.length > 0 && (
              <ul className="notice__files">
                {listed.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
                {hidden > 0 && <li>and {hidden} more</li>}
              </ul>
            )}
            {notice.message && <p className="notice__message">{notice.message}</p>}
            {notice.itemId && (
              <button
                type="button"
                className="control-panel__button control-panel__button--danger notice__action"
                onClick={() => onRemoveItem(notice.itemId)}
              >
                Remove file
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default NoticeStack
