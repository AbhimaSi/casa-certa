import { LIMITE_COMPROMETIMENTO_RENDA } from '../calculo/margem'
import type { ResultadoFinanciamento } from '../calculo/financiamento'
import { GraficoLinha, type Serie } from '../ui/GraficoLinha'
import { brl0, pct } from '../ui/formatos'
import { CORES, nomeSistema, type Simulacao } from '../ui/simulacao'

interface Props {
  sim: Simulacao
  onEditar: () => void
  onDetalhar: () => void
}

/** Tela 2 — Resultado comparativo (RF02, RF03, RF04). */
export function TelaResultado({ sim, onEditar, onDetalhar }: Props) {
  const { dados: d, financiamentos, consorcio, lance, margens, algumAcima } = sim

  // Custo acumulado mês a mês. O financiamento começa na entrada; o consórcio soma parcela + lance.
  const series: Serie[] = [
    ...financiamentos.map((f) => ({
      nome: `Financiamento ${nomeSistema(f.sistema)}`,
      cor: CORES[f.sistema],
      pontos: acumular(f.parcelas.map((p) => p.parcela), d.entrada),
    })),
    {
      nome: 'Consórcio',
      cor: CORES.CONSORCIO,
      tracejada: true,
      pontos: acumular(consorcio.parcelas.map((p) => p.parcela + p.lance), 0),
    },
  ]

  const f0 = financiamentos[0]
  const diferenca = f0.custoTotal - consorcio.custoTotal
  const absoluta = Math.abs(diferenca)
  const relativa = absoluta / Math.max(f0.custoTotal, consorcio.custoTotal)
  const maisBarato = diferenca > 0 ? 'o consórcio' : 'o financiamento'

  return (
    <section aria-labelledby="t2">
      <h1 id="t2">Resultado da simulação</h1>
      <p className="lead">
        Imóvel de {brl0(d.valorImovel)} · entrada de {brl0(d.entrada)} · renda de {brl0(d.renda)}.
      </p>

      {algumAcima ? (
        <div className="banner warn" role="alert">
          <span className="ic" aria-hidden="true">⚠</span>
          <div>
            <b>Parcela acima do limite de 30% da renda.</b>
            <ul>
              {margens
                .filter((m) => !m.avaliacao.dentroDoLimite)
                .map((m) => (
                  <li key={m.nome}>
                    {m.nome}: {pct(m.avaliacao.comprometimento)} da renda, excede em {brl0(m.avaliacao.excedente)}.
                  </li>
                ))}
            </ul>
            <div style={{ marginTop: 6 }}>Para reduzir: aumente a entrada, alongue o prazo ou escolha um imóvel de menor valor.</div>
          </div>
        </div>
      ) : (
        <div className="banner ok" role="status">
          <span className="ic" aria-hidden="true">✔</span>
          <div>
            <b>Cabe na sua renda.</b>{' '}
            {margens.map((m) => `${m.nome}: ${pct(m.avaliacao.comprometimento)} (${m.rotulo})`).join(' · ')}. O limite é de 30% de{' '}
            {brl0(d.renda)}, ou seja, {brl0(d.renda * LIMITE_COMPROMETIMENTO_RENDA)} por mês.
          </div>
        </div>
      )}

      <div className={'grid ' + (financiamentos.length + 1 === 3 ? 'g3' : 'g2')}>
        {financiamentos.map((f) => (
          <CartaoFinanciamento key={f.sistema} f={f} />
        ))}
        <div className="card">
          <h3>
            Consórcio
            <span className="tag">
              {consorcio.prazoEfetivo} meses{consorcio.prazoEfetivo < d.prazoConsorcio ? ' (reduzido pelo lance)' : ''}
            </span>
          </h3>
          <div className="big">{brl0(consorcio.primeiraParcela)}</div>
          <div className="sub">
            1ª parcela · reajuste do INCC a cada 12 meses
            {lance ? ` · lance de ${brl0(lance.valor)} no mês ${lance.mes}` : ''}
          </div>
          <div style={{ marginTop: 12 }}>
            <Linha k="Carta de crédito" v={brl0(d.valorImovel)} />
            <Linha k="Taxa de administração" v={brl0(consorcio.totalTaxaAdministracao)} />
            <Linha k="Fundo de reserva" v={brl0(consorcio.totalFundoReserva)} />
            <Linha k="Última parcela" v={brl0(consorcio.ultimaParcela)} />
            <Linha k="Custo total (parcelas + lance)" v={brl0(consorcio.custoTotal)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Custo total ao longo do tempo</h2>
        <GraficoLinha series={series} altura={300} ariaLabel="Gráfico de linhas do custo acumulado por mês" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Resumo</h2>
        <p style={{ margin: 0 }}>
          No cenário simulado, {maisBarato} tem custo total {brl0(absoluta)} menor ({pct(relativa)}), comparando{' '}
          {f0.sistema === 'SAC' ? 'o SAC' : 'a Price'} com o consórcio. Lembre-se: o financiamento libera o imóvel agora,
          enquanto o consórcio só entrega a carta de crédito após a contemplação (sorteio ou lance). Este resumo não é uma
          recomendação.
        </p>
      </div>

      <div className="actions">
        <button type="button" className="btn sec" onClick={onEditar}>
          ← Editar dados
        </button>
        <button type="button" className="btn" onClick={onDetalhar}>
          Ver detalhamento →
        </button>
      </div>
    </section>
  )
}

/** Soma corrida: [a, b, c] com início x → [x+a, x+a+b, x+a+b+c]. */
function acumular(valores: number[], inicio: number): number[] {
  const saida: number[] = []
  let total = inicio
  for (const v of valores) {
    total += v
    saida.push(total)
  }
  return saida
}

function CartaoFinanciamento({ f }: { f: ResultadoFinanciamento }) {
  return (
    <div className="card">
      <h3>
        Financiamento
        <span className="tag">
          {nomeSistema(f.sistema)} · {f.parcelas.length} meses
        </span>
      </h3>
      <div className="big">{brl0(f.primeiraParcela)}</div>
      <div className="sub">
        1ª parcela · maior {brl0(f.maiorParcela)} · última {brl0(f.ultimaParcela)}
      </div>
      <div style={{ marginTop: 12 }}>
        <Linha k="Valor financiado" v={brl0(f.valorFinanciado)} />
        <Linha k="Total de juros" v={brl0(f.totalJuros)} />
        <Linha k="Seguros e tarifa" v={brl0(f.totalMip + f.totalDfi + f.totalTaxaAdministracao)} />
        <Linha k="CET (ao ano)" v={pct(f.cetAnual, 2)} />
        <Linha k="Custo total (entrada + parcelas)" v={brl0(f.custoTotal)} />
      </div>
    </div>
  )
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  )
}
