import { TextArea as HeroTextArea } from '@heroui/react'
import type { TextareaHTMLAttributes } from 'react'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string
  required?: boolean
}

export function Textarea({ label, error, required, className = '', id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <HeroTextArea
        id={inputId}
        variant="secondary"
        className="min-h-[120px] rounded-[var(--radius-lg)] border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
        {...(props as object)}
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>
      )}
    </div>
  )
}
