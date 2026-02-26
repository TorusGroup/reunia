import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Termos de Uso — ReunIA',
  description: 'Termos e condicoes de uso da plataforma ReunIA.',
}

export default function TermosPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen py-12 px-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-deep-indigo)' }}>
            Termos de Uso
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>Ultima atualizacao: 2026</p>

          <div
            className="rounded-2xl p-8 space-y-6"
            style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
          >
            {[
              {
                title: '1. Sobre a Plataforma',
                body: 'O ReunIA e uma plataforma open source de busca de criancas desaparecidas que agrega dados publicos de diversas fontes (FBI, Interpol, NCMEC, Disque 100 e outras). O acesso e gratuito. A plataforma nao substitui o registro policial oficial.',
              },
              {
                title: '2. Uso Responsavel',
                body: 'Ao usar esta plataforma, voce concorda em: (a) usar os dados exclusivamente para fins legitimos de busca; (b) nao usar as informacoes para assedio, stalking ou qualquer atividade ilegal; (c) reportar avistamentos apenas quando tiver informacoes verdicosas; (d) respeitar a privacidade das criancas e familias envolvidas.',
              },
              {
                title: '3. Alertas e Notificacoes',
                body: 'Ao se cadastrar para receber alertas, voce pode cancelar a qualquer momento atraves do link presente em cada mensagem. Voce nao sera cobrado por este servico. A frequencia de alertas e definida por voce no momento do cadastro.',
              },
              {
                title: '4. Reconhecimento Facial',
                body: 'O sistema de reconhecimento facial e uma ferramenta de apoio. TODA correspondencia facial e revisada por um operador humano antes de qualquer acao ser tomada. O sistema nunca age de forma automatica sobre resultados de reconhecimento facial.',
              },
              {
                title: '5. Limitacao de Responsabilidade',
                body: 'O ReunIA agrega dados de fontes terceiras e pode conter informacoes desatualizadas. Sempre verifique com as fontes originais (FBI, Interpol, NCMEC) para informacoes criticas. Em caso de emergencia, contate as autoridades policiais diretamente (190).',
              },
              {
                title: '6. Conteudo de Terceiros',
                body: 'Dados de casos originados de FBI, Interpol, NCMEC e outras fontes permanecem de propriedade dessas organizacoes. O ReunIA apenas agrega e exibe essas informacoes para fins humanitarios.',
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
