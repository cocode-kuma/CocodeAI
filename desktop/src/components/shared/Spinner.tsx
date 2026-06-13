import { Spinner as HeroSpinner } from '@heroui/react'

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <HeroSpinner size={size} className={className} color="accent" />
}
