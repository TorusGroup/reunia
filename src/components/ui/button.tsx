import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'

// =============================================================
// Button Component — ReunIA Design System (E1-S08)
// Based on brand tokens: Coral Hope primary, Deep Indigo secondary
// =============================================================

const buttonVariants = cva(
  // Base styles
  [
    'inline-flex items-center justify-center gap-2',
    'font-semibold rounded-lg',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'select-none',
  ],
  {
    variants: {
      variant: {
        // Primary — Coral Hope (main CTA)
        primary: [
          'bg-[#E8634A] text-white',
          'hover:bg-[#D44B32] active:bg-[#B03A24]',
          'focus-visible:ring-[#E8634A]',
          'shadow-sm hover:shadow-md',
        ],
        // Secondary — Deep Indigo (LE / admin context)
        secondary: [
          'bg-[#2D3561] text-white',
          'hover:bg-[#232A4E] active:bg-[#1A1F3B]',
          'focus-visible:ring-[#2D3561]',
          'shadow-sm hover:shadow-md',
        ],
        // Outline — Bordered, transparent bg
        outline: [
          'border-2 border-[#E8634A] text-[#E8634A] bg-transparent',
          'hover:bg-[#E8634A] hover:text-white',
          'focus-visible:ring-[#E8634A]',
        ],
        // Ghost — No background, subtle hover
        ghost: [
          'text-[#6B7280] bg-transparent',
          'hover:bg-[#F3F4F6] hover:text-[#111827]',
          'focus-visible:ring-[#6B7280]',
        ],
        // Danger — For destructive actions
        danger: [
          'bg-[#DC2626] text-white',
          'hover:bg-[#B91C1C] active:bg-[#991B1B]',
          'focus-visible:ring-[#DC2626]',
        ],
        // Found Green — For positive/success actions
        success: [
          'bg-[#10B981] text-white',
          'hover:bg-[#059669] active:bg-[#047857]',
          'focus-visible:ring-[#10B981]',
        ],
      },
      size: {
        xs: 'px-3 py-1.5 text-xs',
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
        icon: 'w-9 h-9 p-0',
      },
      width: {
        auto: 'w-auto',
        full: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      width: 'auto',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      width,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(buttonVariants({ variant, size, width }), className)}
        disabled={disabled ?? loading}
        aria-busy={loading}
        style={{ fontFamily: 'var(--font-heading)' }}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
