/**
 * Camada de estado da simulação: liga o formulário aos motores de cálculo (Seção 3.1 do
 * documento da Fase 1). Aqui ficam os dados do formulário, a validação e a execução.
 * Nenhuma regra de cálculo vive aqui — tudo vem de src/calculo.
 */
import { simularFinanciamento, type ResultadoFinanciamento } from '../calculo/financiamento'
import { simularConsorcio, type Lance, type ModoLance, type ResultadoConsorcio } from '../calculo/consorcio'
import { avaliarMargem, type AvaliacaoMargem } from '../calculo/margem'
import { TAXAS_CONSORCIO, TAXAS_FINANCIAMENTO } from '../config/taxasMercado'

export type EscolhaSistema = 'SAC' | 'PRICE' | 'AMBOS'

/** Tudo em unidades "humanas": percentuais em %, dinheiro em R$. Convertido só na execução. */
export interface DadosSimulacao {
  valorImovel: number
  entrada: number
  renda: number
  idade: number
  prazoFinanciamento: number
  prazoConsorcio: number
  sistema: EscolhaSistema
  /** % ao ano */
  jurosAnual: number
  /** % ao mês (TR); 0 = ignorar */
  trMensal: number
  /** R$ por mês */
  tarifa: number
  /** % sobre a carta */
  taxaAdmConsorcio: number
  /** % sobre a carta */
  fundoReserva: number
  /** % ao ano */
  inccAnual: number
  /** NaN quando não há lance */
  lanceMes: number
  lanceValor: number
  lanceModo: ModoLance
}

export const PRAZOS_FINANCIAMENTO = [120, 240, 300, 360, 420]
export const PRAZOS_CONSORCIO = [100, 150, 200, 240]

export const DADOS_INICIAIS: DadosSimulacao = {
  valorImovel: 400_000,
  entrada: 80_000,
  renda: 14_000,
  idade: 30,
  prazoFinanciamento: 360,
  prazoConsorcio: 200,
  sistema: 'SAC',
  jurosAnual: TAXAS_FINANCIAMENTO.jurosAnual * 100,
  trMensal: TAXAS_FINANCIAMENTO.correcaoMensal * 100,
  tarifa: TAXAS_FINANCIAMENTO.taxaAdministracaoMensal,
  taxaAdmConsorcio: TAXAS_CONSORCIO.taxaAdministracao * 100,
  fundoReserva: TAXAS_CONSORCIO.fundoReserva * 100,
  inccAnual: TAXAS_CONSORCIO.inccAnual * 100,
  lanceMes: NaN,
  lanceValor: NaN,
  lanceModo: 'reduzirPrazo',
}

export type Erros = Partial<Record<keyof DadosSimulacao, string>>

export function temLance(d: DadosSimulacao): boolean {
  return !Number.isNaN(d.lanceMes) || (!Number.isNaN(d.lanceValor) && d.lanceValor !== 0)
}

export function validar(d: DadosSimulacao): Erros {
  const e: Erros = {}
  if (!(d.valorImovel > 0)) e.valorImovel = 'Informe um valor maior que zero.'
  if (!(d.entrada >= 0)) e.entrada = 'A entrada não pode ser negativa.'
  else if (d.valorImovel > 0 && d.entrada >= d.valorImovel)
    e.entrada = 'A entrada deve ser menor que o valor do imóvel.'
  if (!(d.renda > 0)) e.renda = 'Informe uma renda maior que zero.'
  if (!Number.isInteger(d.idade) || d.idade < 18) e.idade = 'A idade mínima é 18 anos.'
  if (temLance(d)) {
    if (!Number.isInteger(d.lanceMes) || d.lanceMes < 1 || d.lanceMes > d.prazoConsorcio)
      e.lanceMes = `Informe um mês entre 1 e ${d.prazoConsorcio}.`
    if (!(d.lanceValor > 0)) e.lanceValor = 'Informe o valor do lance.'
  }
  const premissas: (keyof DadosSimulacao)[] = ['jurosAnual', 'trMensal', 'tarifa', 'taxaAdmConsorcio', 'fundoReserva', 'inccAnual']
  for (const k of premissas) {
    const v = d[k] as number
    if (Number.isNaN(v) || v < 0) e[k] = 'Informe um número maior ou igual a zero.'
  }
  return e
}

export interface ItemMargem {
  nome: string
  parcela: number
  rotulo: string
  avaliacao: AvaliacaoMargem
}

export interface Simulacao {
  dados: DadosSimulacao
  financiamentos: ResultadoFinanciamento[]
  consorcio: ResultadoConsorcio
  lance: Lance | null
  /** Regra dos 30% por modalidade (RN01): financiamento usa a MAIOR parcela, consórcio a INICIAL. */
  margens: ItemMargem[]
  algumAcima: boolean
}

export function executarSimulacao(d: DadosSimulacao): Simulacao {
  const lance: Lance | null = temLance(d) ? { mes: d.lanceMes, valor: d.lanceValor, modo: d.lanceModo } : null

  const base = {
    valorImovel: d.valorImovel,
    entrada: d.entrada,
    prazoMeses: d.prazoFinanciamento,
    idade: d.idade,
    jurosAnual: d.jurosAnual / 100,
    correcaoMensal: d.trMensal / 100,
    taxaAdministracaoMensal: d.tarifa,
  }
  const financiamentos: ResultadoFinanciamento[] = []
  if (d.sistema !== 'PRICE') financiamentos.push(simularFinanciamento({ ...base, sistema: 'SAC' }))
  if (d.sistema !== 'SAC') financiamentos.push(simularFinanciamento({ ...base, sistema: 'PRICE' }))

  const consorcio = simularConsorcio({
    valorCarta: d.valorImovel,
    prazoMeses: d.prazoConsorcio,
    taxaAdministracao: d.taxaAdmConsorcio / 100,
    fundoReserva: d.fundoReserva / 100,
    inccAnual: d.inccAnual / 100,
    lances: lance ? [lance] : [],
  })

  const margens: ItemMargem[] = [
    ...financiamentos.map((f) => ({
      nome: `Financiamento ${nomeSistema(f.sistema)}`,
      parcela: f.maiorParcela,
      rotulo: 'maior parcela',
      avaliacao: avaliarMargem(d.renda, f.maiorParcela),
    })),
    {
      nome: 'Consórcio',
      parcela: consorcio.primeiraParcela,
      rotulo: 'parcela inicial',
      avaliacao: avaliarMargem(d.renda, consorcio.primeiraParcela),
    },
  ]

  return {
    dados: d,
    financiamentos,
    consorcio,
    lance,
    margens,
    algumAcima: margens.some((m) => !m.avaliacao.dentroDoLimite),
  }
}

export const nomeSistema = (s: 'SAC' | 'PRICE') => (s === 'SAC' ? 'SAC' : 'Price')

export const CORES = { SAC: '#0f5c63', PRICE: '#e07a1f', CONSORCIO: '#6a4c93' } as const
