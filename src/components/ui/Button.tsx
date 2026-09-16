import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

type ButtonVariant = 'gold' | 'outline' | 'ghost' | 'dark'
type ButtonSize = 'sm' | 'md' | 'lg'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  fullWidth?: boolean
  loading?: boolean
  children: React.ReactNode
}

interface ButtonLinkProps
  extends CommonProps,
    Omit<LinkProps, 'children' | 'to' | 'className'> {
  to: string
}

interface ButtonActionProps
  extends CommonProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  type?: 'button' | 'submit'
}

const baseStyles =
  'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold uppercase tracking-[0.14em] transition-all duration-300 select-none disabled:cursor-not-allowed disabled:opacity-60'

const variantStyles: Record<ButtonVariant, string> = {
  gold: 'bg-gold-500 text-night-950 hover:bg-gold-400 shadow-[0_10px_30px_-10px_rgba(201,162,75,0.55)] hover:shadow-[0_14px_34px_-10px_rgba(201,162,75,0.7)]',
  outline:
    'border border-night-500 text-night-100 hover:border-gold-500 hover:text-gold-400',
  ghost: 'text-night-200 hover:text-gold-400 hover:bg-night-800/60',
  dark: 'bg-night-950 text-night-100 border border-night-700 hover:border-gold-500 hover:text-gold-400',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-[11px]',
  md: 'px-6 py-3 text-[12px]',
  lg: 'px-8 py-4 text-[12px]',
}

export function buttonClasses(
  variant: ButtonVariant = 'gold',
  size: ButtonSize = 'md',
  className?: string,
  fullWidth?: boolean,
) {
  return cn(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && 'w-full',
    className,
  )
}

export function ButtonLink({
  to,
  variant,
  size,
  className,
  fullWidth,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={buttonClasses(variant, size, className, fullWidth)}
      {...rest}
    >
      {children}
    </Link>
  )
}

export function Button({
  variant = 'gold',
  size = 'md',
  className,
  fullWidth,
  loading = false,
  children,
  disabled,
  ...rest
}: ButtonActionProps) {
  return (
    <button
      className={buttonClasses(variant, size, className, fullWidth)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}