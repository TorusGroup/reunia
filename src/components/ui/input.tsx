import { forwardRef } from 'react'
import { clsx } from 'clsx'

// =============================================================
// Input Component — ReunIA Design System (E1-S08)
// =============================================================

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      inputSize = 'md',
      id,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s/g, '-')}` : undefined)

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-4 py-4 text-lg',
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
          >
            {label}
            {required && (
              <span
                className="ml-1"
                style={{ color: 'var(--color-coral-hope)' }}
                aria-label="obrigatório"
              >
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            className={clsx(
              'w-full rounded-lg border transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'placeholder:text-[color:var(--color-text-muted)]',
              sizeClasses[inputSize],
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? [
                    'border-[#DC2626]',
                    'focus:ring-[#DC2626]/30 focus:border-[#DC2626]',
                  ]
                : [
                    'border-[color:var(--color-border)]',
                    'focus:ring-[#E8634A]/30 focus:border-[#E8634A]',
                  ],
              'bg-[color:var(--color-bg-primary)]',
              'text-[color:var(--color-text-primary)]',
              className
            )}
            style={{ fontFamily: 'var(--font-body)' }}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />

          {rightIcon && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
              aria-hidden="true"
            >
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs"
            style={{ color: '#DC2626' }}
            role="alert"
          >
            {error}
          </p>
        )}

        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
