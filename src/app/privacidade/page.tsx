import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Politica de Privacidade — ReunIA',
  description: 'Como o ReunIA coleta, usa e protege seus dados pessoais conforme a LGPD.',
}

export default function PrivacidadePage() {
  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen py-12 px-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
            Politica de Privacidade
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>Ultima atualizacao: 2026</p>

          <div
            className="rounded-2xl p-8 space-y-6"
            style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
          >
            {[
              {
                title: '1. Dados Coletados',
                body: 'O ReunIA coleta apenas os dados necessarios para a busca de criancas desaparecidas. Dados de avistamentos (descricao, localizacao, horario) sao coletados com base no interesse vital da crianca (LGPD Art. 11, II, d). Nenhum dado e compartilhado com terceiros sem consentimento, exceto autoridades competentes quando necessario para a busca.',
              },
              {
                title: '2. Uso dos Dados',
                body: 'Os dados sao usados exclusivamente para: (a) operacao da plataforma de busca; (b) envio de alertas geolocalizados quando solicitado; (c) verificacao de avistamentos por nossa equipe; (d) comunicacao com autoridades competentes quando relevante.',
              },
              {
                title: '3. Seus Direitos (LGPD)',
                body: 'Voce tem direito a: acessar seus dados, corrigir dados incorretos, solicitar exclusao (quando tecnicamente possivel), revogar consentimento a qualquer momento. Para exercer seus direitos, entre em contato via nossa plataforma.',
              },
              {
                title: '4. Seguranca',
                body: 'Todos os dados sao transmitidos via HTTPS (TLS 1.3). Senhas sao armazenadas com bcrypt (fator 12). Dados senssiveis de casos sao acessiveis apenas para usuarios autorizados. Mantemos logs de auditoria para todas as operacoes criticas.',
              },
              {
                title: '5. Contato',
                body: 'Para questoes de privacidade ou para exercer seus direitos LGPD, use os canais de contato disponiveis na plataforma.',
              },
            ].map((section) => (
              <div key={section.title}>
                <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
                  {section.title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
