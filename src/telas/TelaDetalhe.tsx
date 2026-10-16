import { useState } from 'react'
import { GraficoLinha } from '../ui/GraficoLinha'
import { Segmentado } from '../ui/Segmentado'
import { brl0, num2 } from '../ui/formatos'
import { CORES, nomeSistema, type Simulacao } from '../ui/simulacao'

interface Props {
  sim: Simulacao
  onNova: () => void
}

const PASSO = 60

/** Tela 3 — Detalhamento mês a mês (RN02–RN06). */
export function TelaDetalhe({ sim, onNova }: Props) {
  const { financiamentos, consorcio } = sim
  const abas = [
    ...financiamentos.map((f, i) => ({ valor: `fin${i}`, rotulo: `Financ. ${nomeSistema(f.sistema)}` })),
    { valor: 'con', rotulo: 'Consórcio' },
  ]
  const [aba, setAba] = useState(abas[0].valor)
  const [mostrados, setMostrados] = useState(PASSO)
  const abaAtual = abas.some((a) => a.valor === aba) ? aba : abas[0].valor
  const ehConsorcio = abaAtual === 'con'

  // Linhas normalizadas para tabela, cartões mobile e CSV.
  let cabecalho: string[]
  let linhas: { mes: number; valores: number[]; reajuste: boolean; lance: number }[]
  let saldo: number[]
  let cor: string
  if (ehConsorcio) {
    cabecalho = ['Mês', 'Fundo comum', 'Taxa adm.', 'Fundo reserva', 'Parcela', 'Lance', 'Saldo devedor']
    linhas = consorcio.parcelas.map((p) => ({
      mes: p.mes,
      valores: [p.fundoComum, p.taxaAdministracao, p.fundoReserva, p.parcela, p.lance, p.saldoDevedor],
      reajuste: p.reajustado,
      lance: p.lance,
    }))
    saldo = consorcio.parcelas.map((p) => p.saldoDevedor)
    cor = CORES.CONSORCIO
  } else {
    const f = financiamentos[Number(abaAtual.slice(3))]
    cabecalho = ['Mês', 'Amortização', 'Juros', 'MIP', 'DFI', 'Tarifa', 'Parcela', 'Saldo devedor']
    linhas = f.parcelas.map((p) => ({
      mes: p.mes,
      valores: [p.amortizacao, p.juros, p.seguroMip, p.seguroDfi, p.taxaAdministracao, p.parcela, p.saldoDevedor],
      reajuste: false,
      lance: 0,
    }))
    saldo = f.parcelas.map((p) => p.saldoDevedor)
    cor = CORES[f.sistema]
  }
  const visiveis = linhas.slice(0, mostrados)
  const celula = (l: (typeof linhas)[number], i: number) =>
    ehConsorcio && cabecalho[i + 1] === 'Lance' && l.lance === 0 ? '—' : num2(l.valores[i])

  function exportarCsv() {
    const nomes = cabecalho.map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '').normalize('NFD').replace(/[̀-ͯ]/g, ''))
    const corpo = linhas.map((l) => [l.mes, ...l.valores.map((v) => v.toFixed(2))].join(';'))
    const blob = new Blob(['﻿' + nomes.join(';') + '\n' + corpo.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `casa-certa-${ehConsorcio ? 'consorcio' : 'financiamento'}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section aria-labelledby="t3">
      <h1 id="t3">Detalhamento mês a mês</h1>
      <p className="lead">Veja de onde vem cada parte da parcela e como o saldo devedor evolui.</p>

      <Segmentado
        className="abas"
        opcoes={abas}
        valor={abaAtual}
        onChange={(v) => {
          setAba(v)
          setMostrados(PASSO)
        }}
      />

      <div className="card">
        <h2>Evolução do saldo devedor</h2>
        <GraficoLinha series={[{ nome: 'Saldo devedor', cor, pontos: saldo }]} altura={240} ariaLabel="Gráfico da evolução do saldo devedor" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Composição da parcela ({ehConsorcio ? 'consórcio' : 'financiamento'})</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {cabecalho.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.mes} className={l.reajuste ? 'inccrow' : undefined} title={l.reajuste ? 'Reajuste INCC neste mês' : undefined}>
                  <td>{l.mes}</td>
                  {l.valores.map((_, i) => (
                    <td key={i}>{celula(l, i)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cards-m">
          {visiveis.map((l) => (
            <div key={l.mes} className={'mcard' + (l.reajuste ? ' inccrow' : '')}>
              <b>Mês {l.mes}</b>
              {l.reajuste ? ' · reajuste INCC' : ''}
              {cabecalho.slice(1).map((h, i) => (
                <div key={h} className="kv">
                  <span>{h}</span>
                  <b>{celula(l, i)}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
        {mostrados < linhas.length && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button type="button" className="btn sec" onClick={() => setMostrados((m) => m + PASSO)}>
              Carregar mais ({Math.min(mostrados, linhas.length)} de {linhas.length})
            </button>
          </div>
        )}
        <p className="hint" style={{ marginTop: 10 }}>
          Saldo devedor final: {brl0(saldo[saldo.length - 1] ?? 0)} · {linhas.length} meses.
        </p>
      </div>

      <div className="actions">
        <button type="button" className="btn sec" onClick={exportarCsv}>
          Exportar CSV
        </button>
        <button type="button" className="btn" onClick={onNova}>
          Nova simulação
        </button>
      </div>
    </section>
  )
}
