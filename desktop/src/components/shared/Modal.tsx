import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, width = 560, footer }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1000] bg-[var(--color-overlay-scrim)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="fixed inset-0 z-[1001] flex items-center justify-center p-6"
      >
        <div
          className="animate-liquid-reveal max-h-[calc(100vh-48px)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-surface-glass-border)] bg-[var(--color-surface-glass)] shadow-[var(--shadow-liquid-glass)] [backdrop-filter:blur(40px)_saturate(1.8)]"
          style={{ maxWidth: width, width: 'calc(100vw - 48px)' }}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-4 text-xl font-bold text-[var(--color-text-primary)]">
              <h2 id={titleId}>{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}
          <div className="max-h-[calc(100vh-160px)] overflow-y-auto px-6 py-4 text-[var(--color-text-primary)]">
            {children}
          </div>
          {footer && (
            <div className="flex justify-end gap-2 px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
