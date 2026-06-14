import { Input as HeroInputField } from '@heroui/react'
import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  required?: boolean
}

export function Input({ label, error, required, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-primary)]">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <HeroInputField
        id={inputId}
        variant="secondary"
        className="h-9 rounded-[var(--radius-md)] border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
        {...(props as object)}
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>
      )}
    </div>
  )
}
