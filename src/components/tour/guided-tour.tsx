'use client'

// =============================================================
// GuidedTour — Elegant onboarding tour for first-time visitors
// Zero dependencies. Pure CSS + React state.
// =============================================================

import { useState, useEffect, useCallback, useRef } from 'react'

interface TourStep {
  target: string // CSS selector for the element to highlight
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  fallbackPosition?: 'top' | 'bottom' // If element not found, use this for center-screen display
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bem-vindo ao ReunIA',
    description:
      'Ajudamos a encontrar pessoas desaparecidas usando inteligencia artificial. Dados de FBI, Interpol, NCMEC e mais — tudo em um so lugar.',
    position: 'center',
  },
  {
    target: '[role="search"]',
    title: 'Busca Unificada',
    description:
      'Pesquise por nome, localizacao ou caracteristicas. Uma busca consulta simultaneamente todas as nossas fontes de dados internacionais.',
    position: 'bottom',
  },
  {
    target: '[data-tour="recent-cases"]',
    title: 'Casos Recentes',
    description:
      'Veja os casos mais recentes de todas as nossas fontes de dados. Os cards mostram foto, idade, localizacao e ha quantos dias a pessoa esta desaparecida.',
    position: 'top',
  },
  {
    target: '[data-tour="stats"]',
    title: 'Estatisticas em Tempo Real',
    description:
      '8.800+ casos de 3 fontes internacionais. Dados atualizados automaticamente a cada 30 minutos.',
    position: 'top',
  },
  {
    target: '[href="/face-search"]',
    title: 'Busca por Foto',
    description:
      'Use reconhecimento facial com 99.83% de precisao para encontrar correspondencias. Toda correspondencia passa por revisao humana.',
    position: 'bottom',
  },
  {
    target: '[href="/report-sighting"]',
    title: 'Reportar Avistamento',
    description:
      'Viu alguem? Reporte um avistamento e ajude a reunir familias. Cada observacao pode fazer a diferenca.',
    position: 'bottom',
  },
  {
    target: '[href="/geo-alerts"]',
    title: 'Alertas Geolocalizados',
    description:
      'Cadastre-se para receber alertas de novos casos na sua regiao via WhatsApp, SMS ou email.',
    position: 'top',
  },
  {
    target: '[href="/analytics"]',
    title: 'Painel Analitico',
    description:
      'Veja analises e padroes dos dados de desaparecimento. Insights que ajudam autoridades e organizacoes.',
    position: 'bottom',
  },
]

const STORAGE_KEY = 'reunia-tour-completed'

interface GuidedTourProps {
  autoStart?: boolean
}

export function GuidedTour({ autoStart = false }: GuidedTourProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Auto-start on first visit
  useEffect(() => {
    if (autoStart && typeof window !== 'undefined') {
      const completed = localStorage.getItem(STORAGE_KEY)
      if (!completed) {
        // Small delay to let page render
        const timer = setTimeout(() => setIsActive(true), 1200)
        return () => clearTimeout(timer)
      }
    }
  }, [autoStart])

  // Position calculation
  const updateTargetRect = useCallback(() => {
    if (!isActive) return

    const step = TOUR_STEPS[currentStep]
    if (!step) return

    if (step.position === 'center' && step.target === '[data-tour="welcome"]') {
      // Center step — no target element needed
      setTargetRect(null)
      return
    }

    const el = document.querySelector(step.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)

      // Scroll element into view if needed
      const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
      if (!inView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Re-measure after scroll
        setTimeout(() => {
          const newRect = el.getBoundingClientRect()
          setTargetRect(newRect)
        }, 400)
      }
    } else {
      setTargetRect(null)
    }
  }, [currentStep, isActive])

  useEffect(() => {
    updateTargetRect()
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, { passive: true })
    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect)
    }
  }, [updateTargetRect])

  const goNext = useCallback(() => {
    if (currentStep >= TOUR_STEPS.length - 1) {
      completeTour()
      return
    }
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentStep((s) => s + 1)
      setIsAnimating(false)
    }, 200)
  }, [currentStep])

  const goPrev = useCallback(() => {
    if (currentStep <= 0) return
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentStep((s) => s - 1)
      setIsAnimating(false)
    }, 200)
  }, [currentStep])

  const completeTour = useCallback(() => {
    setIsActive(false)
    setCurrentStep(0)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  const startTour = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
    // Scroll to top for the welcome step
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') completeTour()
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isActive, goNext, goPrev, completeTour])

  // Expose startTour globally so the header button can trigger it
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__reuniaTourStart = startTour
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__reuniaTourStart
    }
  }, [startTour])

  if (!isActive) return null

  const step = TOUR_STEPS[currentStep]
  const isCenter = step.position === 'center' || !targetRect
  const padding = 8

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {}
  if (isCenter) {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  } else if (targetRect) {
    const centerX = targetRect.left + targetRect.width / 2
    const gap = 16

    switch (step.position) {
      case 'bottom':
        tooltipStyle = {
          position: 'fixed',
          top: `${targetRect.bottom + gap}px`,
          left: `${Math.max(16, Math.min(centerX - 160, window.innerWidth - 336))}px`,
        }
        break
      case 'top':
        tooltipStyle = {
          position: 'fixed',
          bottom: `${window.innerHeight - targetRect.top + gap}px`,
          left: `${Math.max(16, Math.min(centerX - 160, window.innerWidth - 336))}px`,
        }
        break
      case 'right':
        tooltipStyle = {
          position: 'fixed',
          top: `${targetRect.top}px`,
          left: `${targetRect.right + gap}px`,
        }
        break
      case 'left':
        tooltipStyle = {
          position: 'fixed',
          top: `${targetRect.top}px`,
          right: `${window.innerWidth - targetRect.left + gap}px`,
        }
        break
    }
  }

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 9999 }}
      role="dialog"
      aria-modal="true"
      aria-label="Tour guiado do ReunIA"
    >
      {/* Overlay with spotlight cutout */}
      <svg
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 9999 }}
        onClick={completeTour}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && !isCenter && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(17, 24, 39, 0.65)"
          mask="url(#tour-mask)"
        />
        {/* Spotlight border glow */}
        {targetRect && !isCenter && (
          <rect
            x={targetRect.left - padding}
            y={targetRect.top - padding}
            width={targetRect.width + padding * 2}
            height={targetRect.height + padding * 2}
            rx="12"
            fill="none"
            stroke="var(--color-coral-hope)"
            strokeWidth="2"
            opacity="0.6"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        style={{
          ...tooltipStyle,
          zIndex: 10000,
          maxWidth: '320px',
          width: '320px',
          opacity: isAnimating ? 0 : 1,
          transition: 'opacity 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            boxShadow: 'var(--shadow-modal)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-coral-hope)', fontFamily: 'var(--font-mono)' }}
            >
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <button
              onClick={completeTour}
              className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Fechar tour"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Title */}
          <h3
            className="text-lg font-semibold mb-2"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
          >
            {step.title}
          </h3>

          {/* Description */}
          <p
            className="text-sm leading-relaxed mb-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === currentStep ? '20px' : '6px',
                  height: '6px',
                  backgroundColor:
                    i === currentStep
                      ? 'var(--color-coral-hope)'
                      : i < currentStep
                        ? 'var(--color-coral-hope-light)'
                        : 'var(--color-border)',
                }}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={completeTour}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
            >
              Pular
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={goPrev}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  Anterior
                </button>
              )}
              <button
                onClick={goNext}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{
                  backgroundColor: 'var(--color-coral-hope)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {currentStep === TOUR_STEPS.length - 1 ? 'Concluir' : 'Proximo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
