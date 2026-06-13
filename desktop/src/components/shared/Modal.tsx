import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 4 },
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

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[1000] bg-[var(--color-overlay-scrim)]"
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className="fixed inset-0 z-[1001] flex items-center justify-center p-6 pointer-events-none"
          >
            <motion.div
              key="dialog"
              variants={dialogVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.9 }}
              className="pointer-events-auto max-h-[calc(100vh-48px)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-surface-glass-border)] bg-[var(--color-surface-glass)] shadow-[var(--shadow-modal)] backdrop-blur-xl"
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
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
