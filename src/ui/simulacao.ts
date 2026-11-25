/**
 * Camada de estado da simulação: liga o formulário aos motores de cálculo (Seção 3.1 do
 * documento da Fase 1). Aqui ficam os dados do formulário, a validação e a execução.
 * Nenhuma regra de cálculo vive aqui — tudo vem de src/calculo.
 *
 * Integração com o BCB (módulo bcb.ts):
 *  - RNF02: a tela abre com as taxas padrão (síncronas) e só depois atualiza com as taxas
 *    do BCB; a simulação nunca espera pela rede.
 *  - RNF03: se a API falhar ou estiver offline, as taxas padrão permanecem (fallback do bcb.ts).
 *  - RNF04: os componentes falam só com esta camada (`carregarTaxasMercado`,
 *    `aplicarTaxasBcb`), sem importar o bcb.ts diretamente.
 *  - RF05: a taxa de juros e o INCC vindos do BCB são só valores INICIAIS; se o usuário já
 *    editou o campo manualmente, `aplicarTaxasBcb` não o sobrescreve.
 */
import { simularFinanciamento, type ResultadoFinanciamento } from '../calculo/financiamento'
import { simularConsorcio, type Lance, type ModoLance, type ResultadoConsorcio } from '../calculo/consorcio'
import { avaliarMargem, type AvaliacaoMargem } from '../calculo/margem'
import { TAXAS_CONSORCIO, TAXAS_FINANCIAMENTO } from '../config/taxasMercado'
import { obterTaxasAtuais, obterTaxasPadrao, type TaxasAtuais } from '../services/bcb'

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

/**
 * O bcb.ts trabalha com decimais (0,10 = 10%); esta camada, com percentuais (10).
 * Arredonda em 4 casas para evitar ruídos de ponto flutuante (14,750000000000002)
 * e a dízima do INCC composto, sem perder precisão relevante.
 */
const paraPercentual = (decimal: number) => Math.round(decimal * 1_000_000) / 10_000

/** Taxas padrão (síncronas) — mesma fonte de fallback usada pelo bcb.ts. */
const TAXAS_PADRAO = obterTaxasPadrao()

export const DADOS_INICIAIS: DadosSimulacao = {
  valorImovel: 400_000,
  entrada: 80_000,
  renda: 14_000,
  idade: TAXAS_FINANCIAMENTO.idadePadrao,
  prazoFinanciamento: 360,
  prazoConsorcio: 200,
  sistema: 'SAC',
  jurosAnual: paraPercentual(TAXAS_PADRAO.jurosAnual),
  trMensal: paraPercentual(TAXAS_FINANCIAMENTO.correcaoMensal),
  tarifa: TAXAS_FINANCIAMENTO.taxaAdministracaoMensal,
  taxaAdmConsorcio: paraPercentual(TAXAS_CONSORCIO.taxaAdministracao),
  fundoReserva: paraPercentual(TAXAS_CONSORCIO.fundoReserva),
  inccAnual: paraPercentual(TAXAS_PADRAO.inccAnual),
  lanceMes: NaN,
  lanceValor: NaN,
  lanceModo: 'reduzirPrazo',
}

/* -------------------------------------------------------------------------- */
/* Taxas de mercado (BCB)                                                      */
/* -------------------------------------------------------------------------- */

/** Premissas do formulário que podem vir do BCB e, por RF05, também ser editadas à mão. */
export type PremissaBcb = 'jurosAnual' | 'inccAnual'

/** De onde veio cada taxa ('bcb' ou 'padrao'); útil para rotular os campos na UI. */
export type FontesTaxas = TaxasAtuais['fonte']

/** Estado inicial das fontes: tudo padrão, até a resposta do BCB chegar. */
export const FONTES_INICIAIS: FontesTaxas = TAXAS_PADRAO.fonte

/**
 * Busca as taxas no BCB. Nunca lança erro: o que falhar já volta como padrão
 * (fonte = 'padrao'). Chame sem `await` no carregamento da tela, para não bloquear (RNF02).
 */
export const carregarTaxasMercado = obterTaxasAtuais

/**
 * Aplica ao formulário as taxas vindas do BCB (função pura: devolve novos dados).
 *
 * - Só atualiza taxas cuja fonte é 'bcb' (se veio o padrão, o formulário já o tem).
 * - Não sobrescreve campos que o usuário já editou (`editadas`, RF05).
 * - Devolve o MESMO objeto quando nada muda, evitando re-render desnecessário.
 *
 * Em React, aplique sobre o estado mais recente, pois o usuário pode digitar enquanto a
 * requisição está em andamento: `setDados((atual) => aplicarTaxasBcb(atual, taxas, editadas))`.
 */
export function aplicarTaxasBcb(
  d: DadosSimulacao,
  taxas: TaxasAtuais,
  editadas: ReadonlySet<PremissaBcb> = new Set(),
): DadosSimulacao {
  const jurosAnual =
    taxas.fonte.selic === 'bcb' && !editadas.has('jurosAnual')
      ? paraPercentual(taxas.jurosAnual)
      : d.jurosAnual
  const inccAnual =
    taxas.fonte.incc === 'bcb' && !editadas.has('inccAnual')
      ? Math.max(0, paraPercentual(taxas.inccAnual)) // validar() exige INCC >= 0
      : d.inccAnual

  if (jurosAnual === d.jurosAnual && inccAnual === d.inccAnual) return d
  return { ...d, jurosAnual, inccAnual }
}

/* -------------------------------------------------------------------------- */
/* Validação e execução                                                        */
/* -------------------------------------------------------------------------- */

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
  // Os motores lançam RangeError se o prazo não for um inteiro positivo (RF01).
  if (!Number.isInteger(d.prazoFinanciamento) || d.prazoFinanciamento <= 0)
    e.prazoFinanciamento = 'Informe um prazo inteiro, maior que zero.'
  if (!Number.isInteger(d.prazoConsorcio) || d.prazoConsorcio <= 0)
    e.prazoConsorcio = 'Informe um prazo inteiro, maior que zero.'
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

/**
 * Roda os motores de cálculo. Os motores lançam RangeError para dados inválidos,
 * então chame `validar(d)` antes e só execute quando não houver erros.
 */
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
