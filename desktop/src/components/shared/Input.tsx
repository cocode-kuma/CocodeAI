import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  required?: boolean
}

export function Input({ label, error, required, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-[var(--color-text-primary)] tracking-tight">
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`
          h-9 px-3.5 rounded-[var(--radius-md)] border text-[13px]
          bg-[var(--color-surface-container-lowest)] text-[var(--color-text-primary)]
          placeholder:text-[var(--color-text-tertiary)]
          transition-all duration-150
          ${error
            ? 'border-[var(--color-error)] shadow-[var(--shadow-error-ring)]'
            : 'border-[var(--color-border)] hover:border-[var(--color-outline)] focus:border-[var(--color-border-focus)] focus:shadow-[var(--shadow-focus-ring)]'
          }
          outline-none
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-[var(--color-error)] mt-0.5">{error}</p>}
    </div>
  )
}
