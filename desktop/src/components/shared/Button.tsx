import { Button as HeroButton } from '@heroui/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

const heroVariantMap: Record<ButtonVariant, 'primary' | 'secondary' | 'danger' | 'danger-soft' | 'ghost' | 'outline' | 'tertiary'> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
}

const heroSizeMap: Record<string, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <HeroButton
      variant={heroVariantMap[variant]}
      size={heroSizeMap[size]}
      isDisabled={disabled || loading}
      isIconOnly={false}
      className={`font-medium transition-all duration-150 active:scale-[0.97] ${className}`}
      {...(props as object)}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {children}
        </span>
      ) : icon ? (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      ) : (
        children
      )}
    </HeroButton>
  )
}
