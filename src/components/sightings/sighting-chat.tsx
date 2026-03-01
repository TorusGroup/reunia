'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// =============================================================
// SightingChat — Conversational sighting report
// Feature 5: Chat-based report instead of form
// =============================================================

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  timestamp: Date
}

interface SightingChatProps {
  defaultCaseId?: string
}

type ChatStep =
  | 'intro'
  | 'where'
  | 'when'
  | 'description'
  | 'appearance'
  | 'contact'
  | 'confirm'
  | 'submitted'

const STEP_QUESTIONS: Record<ChatStep, string> = {
  intro: 'Ola! Sou o assistente da ReunIA. Vou ajudar voce a reportar um avistamento de forma rapida. Cada informacao pode fazer a diferenca. Vamos comecar?',
  where: 'Onde voce viu a pessoa? (Cidade, bairro, endereco, ponto de referencia — quanto mais especifico, melhor)',
  when: 'Quando foi o avistamento? (Data e horario aproximados)',
  description: 'Descreva o que voce viu. (O que a pessoa estava fazendo? Estava acompanhada? Parecia estar em perigo?)',
  appearance: 'Descreva a aparencia da pessoa. (Roupas, altura, cabelo, qualquer detalhe que lembre)',
  contact: 'Deseja deixar um contato para que possamos entrar em contato se necessario? (Email ou telefone — opcional, pode digitar "anonimo")',
  confirm: '',
  submitted: 'Avistamento registrado com sucesso! Nossa equipe ira analisar as informacoes e tomar as providencias necessarias. Obrigado por ajudar.',
}

export function SightingChat({ defaultCaseId }: SightingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [step, setStep] = useState<ChatStep>('intro')
  const [submitting, setSubmitting] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Collected data
  const [sightingData, setSightingData] = useState({
    location: '',
    when: '',
    description: '',
    appearance: '',
    contact: '',
  })

  const addMessage = useCallback((role: 'assistant' | 'user', content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}-${Math.random()}`, role, content, timestamp: new Date() },
    ])
  }, [])

  // Initialize
  useEffect(() => {
    addMessage('assistant', STEP_QUESTIONS.intro)
  }, [addMessage])

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function submitSighting() {
    setSubmitting(true)

    try {
      const res = await fetch('/api/v1/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: defaultCaseId || undefined,
          description: `${sightingData.description}\n\nAparencia: ${sightingData.appearance}`,
          locationText: sightingData.location,
          seenAt: sightingData.when || undefined,
          isAnonymous: sightingData.contact.toLowerCase() === 'anonimo' || !sightingData.contact,
          contactInfo: sightingData.contact.toLowerCase() !== 'anonimo' ? sightingData.contact : undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setStep('submitted')
        addMessage('assistant', STEP_QUESTIONS.submitted)
      } else {
        addMessage('assistant', `Houve um erro ao enviar: ${json.error?.message ?? 'tente novamente'}. Suas informacoes nao foram perdidas.`)
      }
    } catch {
      addMessage('assistant', 'Erro de conexao. Suas informacoes foram salvas localmente. Tente novamente em instantes.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSend() {
    if (!input.trim()) return
    const userInput = input.trim()
    addMessage('user', userInput)
    setInput('')

    switch (step) {
      case 'intro':
        setStep('where')
        setTimeout(() => addMessage('assistant', STEP_QUESTIONS.where), 500)
        break

      case 'where':
        setSightingData((d) => ({ ...d, location: userInput }))
        setStep('when')
        setTimeout(() => addMessage('assistant', STEP_QUESTIONS.when), 500)
        break

      case 'when':
        setSightingData((d) => ({ ...d, when: userInput }))
        setStep('description')
        setTimeout(() => addMessage('assistant', STEP_QUESTIONS.description), 500)
        break

      case 'description':
        setSightingData((d) => ({ ...d, description: userInput }))
        setStep('appearance')
        setTimeout(() => addMessage('assistant', STEP_QUESTIONS.appearance), 500)
        break

      case 'appearance':
        setSightingData((d) => ({ ...d, appearance: userInput }))
        setStep('contact')
        setTimeout(() => addMessage('assistant', STEP_QUESTIONS.contact), 500)
        break

      case 'contact': {
        const updatedData = { ...sightingData, contact: userInput }
        setSightingData(updatedData)
        setStep('confirm')
        setTimeout(() => {
          addMessage(
            'assistant',
            `Perfeito! Vou resumir o que voce informou:\n\n` +
              `Local: ${updatedData.location}\n` +
              `Quando: ${updatedData.when}\n` +
              `Descricao: ${updatedData.description}\n` +
              `Aparencia: ${updatedData.appearance}\n` +
              `Contato: ${userInput.toLowerCase() === 'anonimo' ? 'Anonimo' : userInput}\n\n` +
              `Confirma o envio? (sim/nao)`
          )
        }, 500)
        break
      }

      case 'confirm':
        if (userInput.toLowerCase().startsWith('sim') || userInput.toLowerCase().startsWith('s')) {
          submitSighting()
        } else {
          setStep('where')
          setSightingData({ location: '', when: '', description: '', appearance: '', contact: '' })
          setTimeout(() => addMessage('assistant', 'Ok, vamos recomecar. ' + STEP_QUESTIONS.where), 500)
        }
        break

      default:
        break
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-elevated)',
        height: '500px',
      }}
    >
      {/* Chat header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: 'var(--color-deep-indigo)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-coral-hope)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            Assistente ReunIA
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Reportar avistamento via chat
          </p>
        </div>
        {defaultCaseId && (
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--color-coral-hope)', color: 'white', fontSize: '0.6rem' }}
          >
            Caso vinculado
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line"
              style={{
                backgroundColor: msg.role === 'user' ? 'var(--color-deep-indigo)' : 'var(--color-bg-primary)',
                color: msg.role === 'user' ? 'white' : 'var(--color-text-primary)',
                border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {submitting && (
          <div className="flex justify-start">
            <div
              className="px-4 py-2.5 rounded-2xl"
              style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
            >
              <span className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-coral-hope)', borderTopColor: 'transparent' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {step !== 'submitted' && (
        <div
          className="p-3 flex gap-2"
          style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={step === 'intro' ? 'Digite "sim" para comecar...' : 'Digite sua resposta...'}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || submitting}
            className="px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-coral-hope)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
