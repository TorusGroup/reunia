'use client'

// =============================================================
// ReunIA — Face Upload Component
// Drag-and-drop image upload with preview and ethical disclaimer
// Design tokens: coral-hope, deep-indigo, sage, soft-cream
// =============================================================

import React, { useCallback, useRef, useState } from 'react'
import { Upload, X, AlertCircle, Camera, FileImage } from 'lucide-react'

interface FaceUploadProps {
  onImageReady: (base64: string, file: File) => void
  onClear?: () => void
  isProcessing?: boolean
  disabled?: boolean
  /** Shown below uploader — required for citizen-facing upload flows */
  showEthicalDisclaimer?: boolean
  className?: string
}

const MAX_FILE_SIZE_MB = 10
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function FaceUpload({
  onImageReady,
  onClear,
  isProcessing = false,
  disabled = false,
  showEthicalDisclaimer = true,
  className = '',
}: FaceUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    (file: File) => {
      setError(null)

      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Formato não suportado. Use JPG, PNG ou WEBP.')
        return
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`Arquivo muito grande. Máximo ${MAX_FILE_SIZE_MB}MB.`)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setPreview(result)
        setFileName(file.name)
        onImageReady(result, file)
      }
      reader.readAsDataURL(file)
    },
    [onImageReady]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled || isProcessing) return

      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [disabled, isProcessing, processFile]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      // Reset input so the same file can be re-selected
      e.target.value = ''
    },
    [processFile]
  )

  const handleClear = useCallback(() => {
    setPreview(null)
    setFileName(null)
    setError(null)
    onClear?.()
  }, [onClear])

  return (
    <div className={`face-upload-root ${className}`}>
      {/* Drop zone / preview */}
      {preview ? (
        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid var(--color-sage, #7BA098)',
            background: 'var(--color-warm-gray, #F5F0EB)',
          }}
        >
          {/* Preview image */}
          <img
            src={preview}
            alt="Imagem carregada para busca facial"
            style={{
              width: '100%',
              maxHeight: '320px',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          {/* Processing overlay */}
          {isProcessing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(45, 53, 97, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
              aria-live="polite"
              aria-busy="true"
            >
              {/* Radar pulse loader */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '3px solid rgba(232, 99, 74, 0.3)',
                  borderTopColor: 'var(--color-coral-hope, #E8634A)',
                  animation: 'spin 0.8s linear infinite',
                }}
                role="status"
              />
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                Analisando imagem...
              </span>
            </div>
          )}

          {/* Clear button */}
          {!isProcessing && !disabled && (
            <button
              onClick={handleClear}
              aria-label="Remover imagem"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'var(--color-deep-indigo, #2D3561)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <X size={16} />
            </button>
          )}

          {/* File name */}
          {fileName && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--color-warm-gray, #F5F0EB)',
                fontSize: '12px',
                color: 'var(--color-deep-indigo, #2D3561)',
                borderTop: '1px solid rgba(123,160,152,0.3)',
              }}
            >
              <FileImage size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {fileName}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && !isProcessing && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled && !isProcessing) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          disabled={disabled || isProcessing}
          aria-label="Área de upload de foto. Clique ou arraste uma imagem."
          style={{
            width: '100%',
            padding: '40px 24px',
            border: `2px dashed ${dragOver ? 'var(--color-coral-hope, #E8634A)' : 'var(--color-sage, #7BA098)'}`,
            borderRadius: '12px',
            background: dragOver
              ? 'rgba(232, 99, 74, 0.05)'
              : 'var(--color-soft-cream, #FFF8F0)',
            cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'border-color 0.2s, background 0.2s',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--color-deep-indigo, #2D3561)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Upload size={24} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--color-deep-indigo, #2D3561)',
                margin: 0,
              }}
            >
              {dragOver ? 'Solte a foto aqui' : 'Clique ou arraste uma foto'}
            </p>
            <p
              style={{
                fontSize: '13px',
                color: '#6B7280',
                margin: '4px 0 0',
              }}
            >
              JPG, PNG ou WEBP — máximo {MAX_FILE_SIZE_MB}MB
            </p>
          </div>

          {/* Camera icon for mobile context hint */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              color: '#9CA3AF',
              fontSize: '12px',
            }}
          >
            <Camera size={14} />
            <span>Funciona melhor com fotos do rosto</span>
          </div>
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Error message */}
      {error && (
        <div
          role="alert"
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: '#FEF3C7',
            border: '1px solid #F59E0B',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            fontSize: '13px',
            color: '#92400E',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          {error}
        </div>
      )}

      {/* Ethical disclaimer */}
      {showEthicalDisclaimer && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(45, 53, 97, 0.05)',
            border: '1px solid rgba(45, 53, 97, 0.12)',
            fontSize: '12px',
            color: '#4B5563',
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-deep-indigo, #2D3561)' }}>
              Aviso de privacidade:
            </strong>{' '}
            Esta foto é processada exclusivamente para busca de correspondência facial com casos
            registrados. Os dados biométricos não são armazenados permanentemente. Todos os
            resultados passam por revisão humana antes de qualquer ação.
          </p>
          <p style={{ margin: '8px 0 0', fontWeight: 600, color: 'var(--color-coral-hope, #E8634A)' }}>
            Em caso de emergência: CVV 188 (24h, gratuito)
          </p>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
