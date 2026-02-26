'use client'

// =============================================================
// RegistrationForm — Multi-step case registration (4 steps)
// CRITICAL: Auto-save every 60s, mobile-first, accessible
// Sprint 4, E5
// =============================================================

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Step types ────────────────────────────────────────────────

interface Step1Data {
  firstName: string
  lastName: string
  dateOfBirth: string
  approximateAge: string
  gender: 'female' | 'male' | 'other' | ''
  heightCm: string
  weightKg: string
  skinTone: string
  hairColor: string
  eyeColor: string
  distinguishingMarks: string
}

interface Step2Data {
  photos: File[]
}

interface Step3Data {
  lastSeenDate: string
  lastSeenTime: string
  lastSeenLocation: string
  clothingDescription: string
  circumstances: string
  disappearanceType: 'unknown' | 'runaway' | 'family_abduction' | 'abduction' | ''
}

interface Step4Data {
  reporterName: string
  reporterPhone: string
  reporterEmail: string
  relationship: string
  consentLgpd: boolean
  consentCommunications: boolean
}

type FormData = Step1Data & { photos: File[] } & Step3Data & Step4Data

const INITIAL_FORM: FormData = {
  firstName: '', lastName: '', dateOfBirth: '', approximateAge: '', gender: '',
  heightCm: '', weightKg: '', skinTone: '', hairColor: '', eyeColor: '', distinguishingMarks: '',
  photos: [],
  lastSeenDate: '', lastSeenTime: '', lastSeenLocation: '', clothingDescription: '',
  circumstances: '', disappearanceType: '',
  reporterName: '', reporterPhone: '', reporterEmail: '', relationship: '',
  consentLgpd: false, consentCommunications: false,
}

// ── Progress Bar ──────────────────────────────────────────────

interface ProgressBarProps {
  currentStep: number
  steps: string[]
}

function ProgressBar({ currentStep, steps }: ProgressBarProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-0" aria-label="Progresso do formulário">
        {steps.map((label, idx) => {
          const step = idx + 1
          const isDone = step < currentStep
          const isCurrent = step === currentStep

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{
                    backgroundColor: isDone
                      ? 'var(--color-found-green)'
                      : isCurrent
                      ? 'var(--color-coral-hope)'
                      : 'var(--color-border)',
                    color: isDone || isCurrent ? 'white' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-heading)',
                  }}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Passo ${step}: ${label}${isDone ? ' (concluído)' : isCurrent ? ' (atual)' : ''}`}
                >
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : step}
                </div>
                <span
                  className="text-xs mt-1 hidden sm:block"
                  style={{
                    color: isCurrent ? 'var(--color-coral-hope)' : isDone ? 'var(--color-found-green)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-2"
                  style={{
                    backgroundColor: step < currentStep ? 'var(--color-found-green)' : 'var(--color-border)',
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 1: Child data ────────────────────────────────────────

function Step1({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Nome"
          value={data.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })}
          placeholder="Nome"
          required
          autoComplete="given-name"
        />
        <Input
          label="Sobrenome"
          value={data.lastName}
          onChange={(e) => onChange({ lastName: e.target.value })}
          placeholder="Sobrenome"
          autoComplete="family-name"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Data de nascimento"
          type="date"
          value={data.dateOfBirth}
          onChange={(e) => onChange({ dateOfBirth: e.target.value })}
          hint="Ou informe a idade aproximada ao lado"
        />
        <Input
          label="Ou idade aproximada"
          type="number"
          min={0}
          max={18}
          value={data.approximateAge}
          onChange={(e) => onChange({ approximateAge: e.target.value })}
          placeholder="Ex: 8"
        />
      </div>

      {/* Gender */}
      <fieldset>
        <legend
          className="text-sm font-medium mb-2"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
        >
          Gênero
        </legend>
        <div className="flex flex-wrap gap-4">
          {[
            { value: 'female', label: 'Feminino' },
            { value: 'male', label: 'Masculino' },
            { value: 'other', label: 'Prefiro não informar' },
          ].map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value={value}
                checked={data.gender === value}
                onChange={() => onChange({ gender: value as FormData['gender'] })}
                className="w-4 h-4"
                style={{ accentColor: 'var(--color-coral-hope)' }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Physical description */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Input
          label="Altura (cm)"
          type="number"
          value={data.heightCm}
          onChange={(e) => onChange({ heightCm: e.target.value })}
          placeholder="122"
        />
        <Input
          label="Peso (kg)"
          type="number"
          value={data.weightKg}
          onChange={(e) => onChange({ weightKg: e.target.value })}
          placeholder="25"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Tom de pele
          </label>
          <select
            value={data.skinTone}
            onChange={(e) => onChange({ skinTone: e.target.value })}
            className="w-full rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: data.skinTone ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="">Selecionar</option>
            <option value="Muito claro">Muito claro</option>
            <option value="Claro">Claro</option>
            <option value="Médio">Médio</option>
            <option value="Moreno">Moreno</option>
            <option value="Escuro">Escuro</option>
            <option value="Muito escuro">Muito escuro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Cor do cabelo
          </label>
          <select
            value={data.hairColor}
            onChange={(e) => onChange({ hairColor: e.target.value })}
            className="w-full rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: data.hairColor ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="">Selecionar</option>
            <option>Preto</option><option>Castanho escuro</option><option>Castanho claro</option>
            <option>Loiro</option><option>Ruivo</option><option>Grisalho</option><option>Branco</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Cor dos olhos
          </label>
          <select
            value={data.eyeColor}
            onChange={(e) => onChange({ eyeColor: e.target.value })}
            className="w-full rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: data.eyeColor ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="">Selecionar</option>
            <option>Castanhos</option><option>Pretos</option><option>Azuis</option>
            <option>Verdes</option><option>Avelã</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Marcas e características especiais
        </label>
        <textarea
          value={data.distinguishingMarks}
          onChange={(e) => onChange({ distinguishingMarks: e.target.value })}
          placeholder="Descreva cicatrizes, tatuagens, sinais de nascença..."
          rows={3}
          className="w-full rounded-lg border px-4 py-3 text-sm resize-none"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-body)',
          }}
        />
      </div>
    </div>
  )
}

// ── Step 2: Photos ────────────────────────────────────────────

function Step2({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  const [previews, setPreviews] = useState<string[]>([])

  function handleFileChange(files: FileList | null) {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5 - data.photos.length)
    const updated = [...data.photos, ...newFiles]
    onChange({ photos: updated })
    newFiles.forEach((f) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviews((p) => [...p, e.target?.result as string])
      }
      reader.readAsDataURL(f)
    })
  }

  function removePhoto(idx: number) {
    const updated = data.photos.filter((_, i) => i !== idx)
    onChange({ photos: updated })
    setPreviews((p) => p.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Envie até 5 fotos recentes, nítidas, com o rosto visível.
      </p>

      {/* Upload zone */}
      <div
        className="rounded-xl p-8 text-center"
        style={{
          border: '2px dashed var(--color-border)',
          backgroundColor: 'var(--color-bg-tertiary)',
        }}
      >
        <input
          type="file"
          id="photo-upload"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => handleFileChange(e.target.files)}
          aria-label="Selecionar fotos"
        />
        <label htmlFor="photo-upload" className="cursor-pointer block">
          <div className="text-4xl mb-3" aria-hidden="true">+</div>
          <p className="font-semibold text-sm" style={{ color: 'var(--color-deep-indigo)', fontFamily: 'var(--font-heading)' }}>
            Adicionar foto
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            JPEG, PNG, WebP · máx. 10MB cada
          </p>
        </label>
      </div>

      {/* Mobile camera / gallery buttons */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <label htmlFor="photo-camera" className="cursor-pointer">
          <input
            type="file"
            id="photo-camera"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files)}
          />
          <div
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold"
            style={{
              border: '1.5px solid var(--color-deep-indigo)',
              color: 'var(--color-deep-indigo)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Tirar foto
          </div>
        </label>
        <label htmlFor="photo-gallery" className="cursor-pointer">
          <input
            type="file"
            id="photo-gallery"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files)}
          />
          <div
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold"
            style={{
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Galeria
          </div>
        </label>
      </div>

      {/* Photo previews */}
      {previews.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Fotos adicionadas ({data.photos.length}/5):
          </p>
          {data.photos.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
            >
              {previews[idx] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[idx]}
                  alt={`Preview ${idx + 1}`}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                onClick={() => removePhoto(idx)}
                className="flex-shrink-0 text-sm"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={`Remover foto ${idx + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      <div
        className="flex items-start gap-3 p-3 rounded-lg"
        style={{ backgroundColor: 'var(--color-alert-amber-light)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
        </svg>
        <p className="text-sm" style={{ color: '#92400E' }}>
          Fotos com boa iluminação melhoram a precisão do reconhecimento facial.
        </p>
      </div>
    </div>
  )
}

// ── Step 3: Location & circumstances ─────────────────────────

function Step3({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Última vez vista / visto — Data"
          type="date"
          value={data.lastSeenDate}
          onChange={(e) => onChange({ lastSeenDate: e.target.value })}
          required
        />
        <Input
          label="Horário"
          type="time"
          value={data.lastSeenTime}
          onChange={(e) => onChange({ lastSeenTime: e.target.value })}
        />
      </div>

      <Input
        label="Local exato ou aproximado"
        value={data.lastSeenLocation}
        onChange={(e) => onChange({ lastSeenLocation: e.target.value })}
        placeholder="Av. Paulista, São Paulo, SP"
        required
        rightIcon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        }
      />

      {/* Map placeholder */}
      <div
        className="rounded-xl h-40 flex items-center justify-center"
        style={{ backgroundColor: '#E8EAF0', border: '1px solid var(--color-border)' }}
        role="img"
        aria-label="Mapa de confirmação de localização — disponível em Sprint 6"
      >
        <p className="text-sm" style={{ color: 'var(--color-warm-gray)' }}>
          Confirmar no mapa — Sprint 6
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Roupa que estava usando
        </label>
        <textarea
          value={data.clothingDescription}
          onChange={(e) => onChange({ clothingDescription: e.target.value })}
          placeholder="Descreva a roupa que a criança usava quando desapareceu..."
          rows={2}
          className="w-full rounded-lg border px-4 py-3 text-sm resize-none"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-body)',
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Circunstâncias do desaparecimento
        </label>
        <textarea
          value={data.circumstances}
          onChange={(e) => onChange({ circumstances: e.target.value })}
          placeholder="O que você sabe sobre o desaparecimento? Qualquer detalhe ajuda."
          rows={4}
          className="w-full rounded-lg border px-4 py-3 text-sm resize-none"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-body)',
          }}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Tipo de desaparecimento (opcional)
        </legend>
        <div className="space-y-2">
          {[
            { value: 'unknown', label: 'Desconhecido' },
            { value: 'runaway', label: 'Fuga voluntária' },
            { value: 'family_abduction', label: 'Sequestro familiar' },
            { value: 'abduction', label: 'Sequestro por desconhecido' },
          ].map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="disappearanceType"
                value={value}
                checked={data.disappearanceType === value}
                onChange={() => onChange({ disappearanceType: value as FormData['disappearanceType'] })}
                className="w-4 h-4"
                style={{ accentColor: 'var(--color-coral-hope)' }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

// ── Step 4: Contact & consent ─────────────────────────────────

function Step4({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Seus dados de contato serão usados apenas para atualização sobre o caso. Não serão publicados.
      </p>

      <Input
        label="Seu nome completo"
        value={data.reporterName}
        onChange={(e) => onChange({ reporterName: e.target.value })}
        placeholder="Nome completo"
        required
        autoComplete="name"
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Telefone (WhatsApp preferencialmente)"
          type="tel"
          value={data.reporterPhone}
          onChange={(e) => onChange({ reporterPhone: e.target.value })}
          placeholder="+55 (11) 99999-0000"
          required
          autoComplete="tel"
        />
        <Input
          label="E-mail (opcional)"
          type="email"
          value={data.reporterEmail}
          onChange={(e) => onChange({ reporterEmail: e.target.value })}
          placeholder="seu@email.com"
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Sua relação com a criança
        </label>
        <select
          value={data.relationship}
          onChange={(e) => onChange({ relationship: e.target.value })}
          required
          className="w-full rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            color: data.relationship ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <option value="">Selecionar...</option>
          <option value="parent">Pai/Mãe</option>
          <option value="guardian">Responsável legal</option>
          <option value="relative">Familiar</option>
          <option value="police">Autoridade policial</option>
          <option value="ngo">ONG/Assistência social</option>
          <option value="other">Outro</option>
        </select>
      </div>

      {/* Consents */}
      <div className="space-y-3 pt-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.consentLgpd}
            onChange={(e) => onChange({ consentLgpd: e.target.checked })}
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ accentColor: 'var(--color-coral-hope)' }}
            required
          />
          <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
            Li e aceito os{' '}
            <a href="/termos" className="underline" style={{ color: 'var(--color-data-blue)' }}>
              Termos de Uso
            </a>{' '}
            e a{' '}
            <a href="/privacidade" className="underline" style={{ color: 'var(--color-data-blue)' }}>
              Política de Privacidade
            </a>
            . Autorizo o uso das informações para a busca da criança conforme a LGPD, base legal de interesse vital (Art. 11, II, "d").
            <span className="text-red-500 ml-1" aria-label="obrigatório">*</span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.consentCommunications}
            onChange={(e) => onChange({ consentCommunications: e.target.checked })}
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ accentColor: 'var(--color-coral-hope)' }}
          />
          <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Aceito receber atualizações sobre o caso por WhatsApp/email.
          </span>
        </label>
      </div>
    </div>
  )
}

// ── Confirmation ──────────────────────────────────────────────

function Confirmation({ caseNumber }: { caseNumber: string }) {
  return (
    <div className="text-center py-8">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: 'var(--color-found-green-light)' }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-found-green)" strokeWidth="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2
        className="text-2xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
      >
        Caso registrado com sucesso
      </h2>

      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
        O caso já está ativo na plataforma e sendo buscado em múltiplas bases de dados.
      </p>

      {/* Case number — prominent, JetBrains Mono */}
      <div
        className="inline-block px-6 py-4 rounded-xl mb-6"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Número do caso
        </p>
        <p
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-deep-indigo)' }}
        >
          {caseNumber}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Guarde este número. Você precisará dele para atualizações.
        </p>
      </div>

      {/* CVV 188 — always visible per spec */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl mb-6 text-left"
        style={{
          backgroundColor: 'var(--color-alert-amber-light)',
          border: '1px solid var(--color-alert-amber)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#92400E', fontFamily: 'var(--font-heading)' }}>
            Precisa de apoio emocional?
          </p>
          <p className="text-sm mt-1" style={{ color: '#92400E' }}>
            Ligue para o{' '}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>188</strong>{' '}
            (CVV — Valorização da Vida) ou{' '}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>100</strong>{' '}
            (Disque Direitos Humanos). Atendimento 24h, gratuito.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/search"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: 'var(--color-coral-hope)',
            color: 'white',
            fontFamily: 'var(--font-heading)',
          }}
        >
          Buscar na plataforma
        </a>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
          style={{
            border: '1.5px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          Ver meus casos
        </a>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

const STEPS = ['Criança', 'Fotos', 'Local', 'Contato']
const DRAFT_KEY = 'reunia_registration_draft'

export function RegistrationForm() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [caseNumber, setCaseNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Load draft from localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        const parsed = JSON.parse(draft)
        setData({ ...INITIAL_FORM, ...parsed, photos: [] })
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Auto-save every 60 seconds
  const saveDraft = useCallback(() => {
    try {
      const toSave = { ...data, photos: [] } // Files can't be serialized
      localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave))
      setLastSaved(new Date())
    } catch {
      // Ignore storage errors
    }
  }, [data])

  useEffect(() => {
    const interval = setInterval(saveDraft, 60000)
    return () => clearInterval(interval)
  }, [saveDraft])

  function handleChange(changed: Partial<FormData>) {
    setData((prev) => ({ ...prev, ...changed }))
  }

  function handleNext() {
    saveDraft()
    setStep((s) => Math.min(4, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      // Sprint 5: replace with actual API call
      // const res = await fetch('/api/v1/cases', { method: 'POST', body: formData })
      await new Promise<void>((res) => setTimeout(res, 1500))
      const num = `REUNIA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(6, '0')}`
      setCaseNumber(num)
      localStorage.removeItem(DRAFT_KEY)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const canProceed1 = !!data.firstName && (!!data.dateOfBirth || !!data.approximateAge) && !!data.gender
  const canProceed3 = !!data.lastSeenDate && !!data.lastSeenLocation
  const canSubmit = !!data.reporterName && !!data.reporterPhone && !!data.relationship && data.consentLgpd

  if (submitted) {
    return <Confirmation caseNumber={caseNumber} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}
        >
          Registrar Desaparecimento
        </h1>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Passo {step} de {STEPS.length}
        </span>
      </div>

      {/* Auto-save indicator */}
      {lastSaved && (
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Rascunho salvo às {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <ProgressBar currentStep={step} steps={STEPS} />

      {/* Step content */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {step === 1 && <Step1 data={data} onChange={handleChange} />}
        {step === 2 && <Step2 data={data} onChange={handleChange} />}
        {step === 3 && <Step3 data={data} onChange={handleChange} />}
        {step === 4 && <Step4 data={data} onChange={handleChange} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        {step > 1 ? (
          <Button variant="ghost" onClick={handleBack}>
            ← Voltar
          </Button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <Button
            onClick={handleNext}
            disabled={step === 1 ? !canProceed1 : step === 3 ? !canProceed3 : false}
            width="auto"
          >
            Próximo →
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          >
            Registrar Caso
          </Button>
        )}
      </div>
    </div>
  )
}
