import { useState } from 'react'
import { TelaDados } from './telas/TelaDados'
import { TelaDetalhe } from './telas/TelaDetalhe'
import { TelaPremissas } from './telas/TelaPremissas'
import { TelaResultado } from './telas/TelaResultado'
import { DADOS_INICIAIS, executarSimulacao, type DadosSimulacao, type Simulacao } from './ui/simulacao'

type Tela = 'dados' | 'resultado' | 'detalhe' | 'premissas'

const ETAPAS: { tela: Tela; rotulo: string }[] = [
  { tela: 'dados', rotulo: '1 · Dados' },
  { tela: 'resultado', rotulo: '2 · Resultado' },
  { tela: 'detalhe', rotulo: '3 · Detalhamento' },
]

export default function App() {
  const [tela, setTela] = useState<Tela>('dados')
  const [dados, setDados] = useState<DadosSimulacao>(DADOS_INICIAIS)
  const [sim, setSim] = useState<Simulacao | null>(null)
  const [erro, setErro] = useState('')

  function ir(t: Tela) {
    setTela(t)
    window.scrollTo({ top: 0 })
  }

  function simular(d: DadosSimulacao) {
    try {
      setSim(executarSimulacao(d))
      setErro('')
      ir('resultado')
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const indice = ETAPAS.findIndex((e) => e.tela === tela)

  return (
    <>
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <header className="site">
        <div className="container">
          <button type="button" className="brand" onClick={() => ir('dados')} aria-label="Casa Certa, início">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M4 15 16 4l12 11v13H4z" fill="#0f5c63" />
              <path d="M13 28V19h6v9" fill="#fff" />
            </svg>
            Casa Certa
          </button>
          <nav>
            <button type="button" className="link" onClick={() => ir('premissas')}>
              Premissas
            </button>
          </nav>
        </div>
      </header>

      <main id="main" className="container" tabIndex={-1}>
        {indice >= 0 && (
          <ol className="steps" aria-label="Etapas">
            {ETAPAS.map((e, i) => (
              <li key={e.tela} className={i === indice ? 'on' : i < indice ? 'done' : ''} aria-current={i === indice ? 'step' : undefined}>
                {e.rotulo}
              </li>
            ))}
          </ol>
        )}

        {erro && (
          <div className="banner warn" role="alert">
            <span className="ic" aria-hidden="true">⚠</span>
            <div>Não foi possível simular: {erro}</div>
          </div>
        )}

        {tela === 'dados' && <TelaDados dados={dados} onChange={setDados} onSimular={simular} />}
        {tela === 'resultado' && sim && <TelaResultado sim={sim} onEditar={() => ir('dados')} onDetalhar={() => ir('detalhe')} />}
        {tela === 'detalhe' && sim && <TelaDetalhe sim={sim} onNova={() => ir('dados')} />}
        {tela === 'premissas' && <TelaPremissas onVoltar={() => ir('dados')} />}
      </main>

      <footer className="site">Simulação educativa. Não constitui oferta de crédito.</footer>
    </>
  )
}
