import { useState } from 'react'
import type { ModoLance } from '../calculo/consorcio'
import { CampoMoeda } from '../ui/CampoMoeda'
import { Segmentado } from '../ui/Segmentado'
import { lerNumero } from '../ui/formatos'
import {
  DADOS_INICIAIS,
  PRAZOS_CONSORCIO,
  PRAZOS_FINANCIAMENTO,
  validar,
  type DadosSimulacao,
  type Erros,
  type EscolhaSistema,
} from '../ui/simulacao'

interface Props {
  dados: DadosSimulacao
  onChange: (d: DadosSimulacao) => void
  onSimular: (d: DadosSimulacao) => void
}

/** Tela 1 — Dados da simulação (RF01, RF05, RN07). */
export function TelaDados({ dados, onChange, onSimular }: Props) {
  const [erros, setErros] = useState<Erros>({})
  const set = <K extends keyof DadosSimulacao>(k: K, v: DadosSimulacao[K]) => onChange({ ...dados, [k]: v })

  const pctEntrada =
    dados.valorImovel > 0 && dados.entrada >= 0 ? Math.round((dados.entrada / dados.valorImovel) * 100) + '%' : '—'

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const errosNovos = validar(dados)
    setErros(errosNovos)
    const primeiro = Object.keys(errosNovos)[0]
    if (primeiro) {
      document.getElementById(primeiro)?.focus()
      return
    }
    onSimular(dados)
  }

  function limpar() {
    onChange(DADOS_INICIAIS)
    setErros({})
  }

  const erro = (k: keyof DadosSimulacao) => (
    <div className="err" role="alert">
      {erros[k] ?? ''}
    </div>
  )

  const campoPct = (id: keyof DadosSimulacao, rotulo: string, dica: string) => (
    <div className="field">
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        inputMode="decimal"
        className={erros[id] ? 'bad' : undefined}
        value={Number.isNaN(dados[id] as number) ? '' : String(dados[id]).replace('.', ',')}
        onChange={(e) => set(id, lerNumero(e.target.value) as never)}
      />
      <div className="hint">{dica}</div>
      {erro(id)}
    </div>
  )

  return (
    <section aria-labelledby="t1">
      <h1 id="t1">Quanto custa o seu imóvel e como você pretende pagar?</h1>
      <p className="lead">Preencha os dados e compare, lado a lado, financiar ou entrar em um consórcio.</p>

      <form className="card" onSubmit={enviar} noValidate>
        <div className="grid g2">
          <div className="field">
            <label htmlFor="valorImovel">Valor do imóvel</label>
            <CampoMoeda id="valorImovel" valor={dados.valorImovel} onChange={(v) => set('valorImovel', v)} invalido={!!erros.valorImovel} />
            {erro('valorImovel')}
          </div>
          <div className="field">
            <label htmlFor="entrada">
              Entrada <span className="pct">{pctEntrada}</span>
            </label>
            <CampoMoeda id="entrada" valor={dados.entrada} onChange={(v) => set('entrada', v)} invalido={!!erros.entrada} />
            <div className="hint">Usada no financiamento. No consórcio vale a carta de crédito.</div>
            {erro('entrada')}
          </div>
          <div className="field">
            <label htmlFor="renda">Renda mensal bruta familiar</label>
            <CampoMoeda id="renda" valor={dados.renda} onChange={(v) => set('renda', v)} invalido={!!erros.renda} />
            {erro('renda')}
          </div>
          <div className="field">
            <label htmlFor="idade">Idade do comprador</label>
            <input
              id="idade"
              type="number"
              min={18}
              max={80}
              className={erros.idade ? 'bad' : undefined}
              value={Number.isNaN(dados.idade) ? '' : dados.idade}
              onChange={(e) => set('idade', parseInt(e.target.value, 10))}
            />
            <div className="hint">Define a faixa do seguro MIP.</div>
            {erro('idade')}
          </div>
          <div className="field">
            <label htmlFor="prazoFinanciamento">Prazo do financiamento</label>
            <select id="prazoFinanciamento" value={dados.prazoFinanciamento} onChange={(e) => set('prazoFinanciamento', Number(e.target.value))}>
              {PRAZOS_FINANCIAMENTO.map((p) => (
                <option key={p} value={p}>
                  {p} meses ({p / 12} anos)
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="prazoConsorcio">Prazo do consórcio</label>
            <select id="prazoConsorcio" value={dados.prazoConsorcio} onChange={(e) => set('prazoConsorcio', Number(e.target.value))}>
              {PRAZOS_CONSORCIO.map((p) => (
                <option key={p} value={p}>
                  {p} meses
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field" style={{ marginTop: 18 }}>
          <label id="lblSistema">Sistema de amortização do financiamento</label>
          <Segmentado<EscolhaSistema>
            aria-labelledby="lblSistema"
            valor={dados.sistema}
            onChange={(v) => set('sistema', v)}
            opcoes={[
              { valor: 'SAC', rotulo: 'SAC' },
              { valor: 'PRICE', rotulo: 'Price' },
              { valor: 'AMBOS', rotulo: 'Comparar os dois' },
            ]}
          />
          <div className="hint">SAC: parcelas decrescentes. Price: parcelas fixas.</div>
        </div>

        <details className="acc">
          <summary>Ajustar premissas (opcional)</summary>
          <div className="body">
            <div className="grid g3">
              {campoPct('jurosAnual', 'Juros anual (financiamento)', '% ao ano')}
              {campoPct('trMensal', 'TR mensal', '% ao mês (0 = ignorar)')}
              <div className="field">
                <label htmlFor="tarifa">Tarifa mensal</label>
                <CampoMoeda id="tarifa" valor={dados.tarifa} onChange={(v) => set('tarifa', v)} invalido={!!erros.tarifa} />
                {erro('tarifa')}
              </div>
              {campoPct('taxaAdmConsorcio', 'Taxa de adm. do consórcio', '% sobre a carta')}
              {campoPct('fundoReserva', 'Fundo de reserva', '% sobre a carta')}
              {campoPct('inccAnual', 'INCC anual', '% ao ano')}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              Valores iniciais = taxas médias de mercado (src/config/taxasMercado.ts).
            </div>
          </div>
        </details>

        <details className="acc">
          <summary>Simular lance no consórcio (opcional)</summary>
          <div className="body">
            <div className="grid g3">
              <div className="field">
                <label htmlFor="lanceMes">Mês do lance</label>
                <input
                  id="lanceMes"
                  type="number"
                  min={1}
                  placeholder="ex.: 24"
                  className={erros.lanceMes ? 'bad' : undefined}
                  value={Number.isNaN(dados.lanceMes) ? '' : dados.lanceMes}
                  onChange={(e) => set('lanceMes', e.target.value === '' ? NaN : parseInt(e.target.value, 10))}
                />
                {erro('lanceMes')}
              </div>
              <div className="field">
                <label htmlFor="lanceValor">Valor do lance</label>
                <CampoMoeda id="lanceValor" valor={dados.lanceValor} onChange={(v) => set('lanceValor', v)} placeholder="0,00" invalido={!!erros.lanceValor} />
                {erro('lanceValor')}
              </div>
              <div className="field">
                <label id="lblModo">Efeito do lance</label>
                <Segmentado<ModoLance>
                  aria-labelledby="lblModo"
                  valor={dados.lanceModo}
                  onChange={(v) => set('lanceModo', v)}
                  opcoes={[
                    { valor: 'reduzirPrazo', rotulo: 'Reduz prazo' },
                    { valor: 'reduzirParcela', rotulo: 'Reduz parcela' },
                  ]}
                />
              </div>
            </div>
          </div>
        </details>

        <div className="actions">
          <button type="button" className="btn sec" onClick={limpar}>
            Limpar
          </button>
          <button type="submit" className="btn">
            Simular →
          </button>
        </div>
      </form>
    </section>
  )
}
