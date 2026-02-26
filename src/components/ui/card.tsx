import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

// =============================================================
// Card Component — ReunIA Design System (E1-S08)
// =============================================================

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'elevated' | 'outline' | 'dark'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  as?: 'div' | 'article' | 'section' | 'li'
  children?: ReactNode
}

function Card({
  className,
  variant = 'default',
  padding = 'md',
  as: Tag = 'div',
  children,
  ...props
}: CardProps) {
  const variantClasses = {
    default: 'bg-white border border-[color:var(--color-border)] shadow-[var(--shadow-card)]',
    elevated: 'bg-white shadow-[var(--shadow-elevated)]',
    outline: 'bg-transparent border-2 border-[color:var(--color-border)]',
    dark: 'bg-[color:var(--color-deep-indigo)] border border-[#3A4275] text-white',
  }

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <Tag
      className={clsx('rounded-xl', variantClasses[variant], paddingClasses[padding], className)}
      {...props}
    >
      {children}
    </Tag>
  )
}

function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('flex items-start justify-between mb-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}

function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx('text-lg font-semibold', className)}
      style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
      {...props}
    >
      {children}
    </h3>
  )
}

function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('', className)} {...props}>
      {children}
    </div>
  )
}

function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between mt-4 pt-4 border-t border-[color:var(--color-border-subtle)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Card, CardHeader, CardTitle, CardBody, CardFooter }
