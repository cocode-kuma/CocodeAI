import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type DropdownItemDef<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: ReactNode
}

type DropdownProps<T extends string> = {
  items: DropdownItemDef<T>[]
  value: T
  onChange: (value: T) => void
  trigger: ReactNode
  width?: CSSProperties['width']
  maxHeight?: CSSProperties['maxHeight']
  align?: 'left' | 'right'
  className?: string
}

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -6 },
  visible: { opacity: 1, scale: 1, y: 0 },
}

export function Dropdown<T extends string>({
  items,
  value,
  onChange,
  trigger,
  width,
  maxHeight = 320,
  align = 'left',
  className = '',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()

  useEffect(() => {
    if (!open) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (dropdownRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const selectItem = (nextValue: T) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block ${className}`}
      style={{ width }}
    >
      <div
        className="cursor-pointer"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.8 }}
            style={{ transformOrigin: 'top', width }}
            className={`absolute top-full z-[100] mt-1 min-w-full rounded-[var(--radius-lg)] border border-[var(--color-surface-glass-border)] bg-[var(--color-surface-glass)] shadow-[var(--shadow-dropdown)] backdrop-blur-xl ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              id={listboxId}
              role="listbox"
              className="overflow-y-auto p-1"
              style={{ maxHeight }}
            >
              {items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={item.value === value}
                  onClick={() => selectItem(item.value)}
                  className={`flex w-full items-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] ${
                    item.value === value ? 'bg-[var(--color-surface-hover)]' : ''
                  }`}
                >
                  {item.icon && (
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[var(--color-text-secondary)]">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.description && (
                      <span className="mt-0.5 block text-xs font-normal text-[var(--color-text-tertiary)]">
                        {item.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
