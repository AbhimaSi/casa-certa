/**
 * Motor de cálculo do financiamento imobiliário.
 *
 * Funções puras, sem dependência de interface (ver Seção 3.3 do documento da Fase 1).
 * Regras atendidas:
 *  - RN02: SAC — amortização constante, juros sobre o saldo devedor, parcelas decrescentes
 *  - RN03: Price — parcela fixa; amortização crescente e juros decrescentes
 *  - RN04: parcela = amortização + juros + seguro MIP + seguro DFI + taxa de administração
 *  - RF03: custo total em R$ e CET (taxa efetiva anual que inclui seguros e tarifa)
 *  - RF05: juros anual, idade (MIP) e demais taxas podem ser sobrescritos
 *
 * Convenções (iguais às do motor de consórcio):
 *  - taxas em fração decimal (0.11 = 11%); valores em R$ sem arredondamento interno.
 *  - juros mensal obtido por equivalência composta: (1 + anual)^(1/12) - 1.
 *  - MIP incide sobre o saldo devedor no início do mês; DFI sobre o valor do imóvel.
 *  - a idade do comprador avança a cada 12 meses e muda a faixa do MIP (prática das seguradoras).
 */
import { TAXAS_FINANCIAMENTO, type FaixaMip } from '../config/taxasMercado'

export type SistemaAmortizacao = 'SAC' | 'PRICE'

export interface ParametrosFinanciamento {
  /** Valor do imóvel em R$ (base do seguro DFI). */
  valorImovel: number
  /** Entrada paga à vista em R$. Valor financiado = imóvel - entrada. */
  entrada: number
  /** Prazo do contrato em meses. */
  prazoMeses: number
  sistema: SistemaAmortizacao
  /** Idade do comprador em anos completos na assinatura. Padrão: config de mercado. */
  idade?: number
  /** Taxa de juros efetiva anual. Padrão: config de mercado. */
  jurosAnual?: number
  /** Correção mensal do saldo devedor (TR). Padrão: config de mercado (0). */
  correcaoMensal?: number
  /** Alíquota mensal do DFI sobre o valor do imóvel. Padrão: config de mercado. */
  dfiMensal?: number
  /** Tarifa fixa mensal em R$. Padrão: config de mercado. */
  taxaAdministracaoMensal?: number
  /** Tabela do MIP por faixa etária, ordenada por idadeMax. Padrão: config de mercado. */
  mipPorIdade?: readonly FaixaMip[]
}

export interface ParcelaFinanciamento {
  mes: number
  amortizacao: number
  juros: number
  seguroMip: number
  seguroDfi: number
  taxaAdministracao: number
  /** Soma de todos os componentes (RN04). */
  parcela: number
  /** Saldo devedor após a amortização do mês. */
  saldoDevedor: number
  /** Idade do comprador considerada neste mês. */
  idade: number
}

export interface ResultadoFinanciamento {
  sistema: SistemaAmortizacao
  parcelas: ParcelaFinanciamento[]
  valorFinanciado: number
  /** Juros mensal equivalente usado no cálculo. */
  jurosMensal: number
  primeiraParcela: number
  ultimaParcela: number
  /** Maior parcela do contrato: é ela que vale para a regra dos 30% (RN01). */
  maiorParcela: number
  totalAmortizacao: number
  totalJuros: number
  totalMip: number
  totalDfi: number
  totalTaxaAdministracao: number
  /** Soma de todas as parcelas pagas ao banco. */
  totalParcelas: number
  /** Entrada + parcelas: total desembolsado pelo imóvel, comparável ao custoTotal do consórcio. */
  custoTotal: number
  /**
   * Custo Efetivo Total como taxa efetiva anual: a taxa interna que iguala o valor
   * financiado ao fluxo de parcelas (juros + seguros + tarifa). Sem extras, é igual a jurosAnual.
   */
  cetAnual: number
}

const EPSILON = 1e-6

type ParametrosCompletos = Required<ParametrosFinanciamento>

function validar(p: ParametrosCompletos) {
  if (!(p.valorImovel > 0)) throw new RangeError('valorImovel deve ser maior que zero')
  if (!(p.entrada >= 0)) throw new RangeError('entrada não pode ser negativa')
  if (p.entrada >= p.valorImovel) throw new RangeError('entrada deve ser menor que o valor do imóvel')
  if (!Number.isInteger(p.prazoMeses) || p.prazoMeses <= 0)
    throw new RangeError('prazoMeses deve ser um inteiro positivo')
  if (p.sistema !== 'SAC' && p.sistema !== 'PRICE') throw new RangeError('sistema deve ser SAC ou PRICE')
  if (!Number.isInteger(p.idade) || p.idade < 18) throw new RangeError('idade deve ser um inteiro maior ou igual a 18')
  if (!(p.jurosAnual >= 0)) throw new RangeError('jurosAnual não pode ser negativo')
  if (p.correcaoMensal <= -1) throw new RangeError('correcaoMensal deve ser maior que -100%')
  if (!(p.dfiMensal >= 0)) throw new RangeError('dfiMensal não pode ser negativo')
  if (!(p.taxaAdministracaoMensal >= 0))
    throw new RangeError('taxaAdministracaoMensal não pode ser negativa')
  if (p.mipPorIdade.length === 0) throw new RangeError('mipPorIdade não pode ser vazia')
  for (const f of p.mipPorIdade) {
    if (!(f.taxa >= 0)) throw new RangeError('taxa do MIP não pode ser negativa')
  }
}

/** Converte taxa efetiva anual em mensal equivalente (juros compostos). */
export function jurosAnualParaMensal(jurosAnual: number): number {
  return Math.pow(1 + jurosAnual, 1 / 12) - 1
}

/** Alíquota mensal do MIP para a idade informada; acima da última faixa, usa a última. */
export function taxaMipPorIdade(
  idade: number,
  tabela: readonly FaixaMip[] = TAXAS_FINANCIAMENTO.mipPorIdade,
): number {
  const faixa = tabela.find((f) => idade <= f.idadeMax) ?? tabela[tabela.length - 1]
  return faixa.taxa
}

/** Parcela fixa da Tabela Price: PMT = PV * i / (1 - (1+i)^-n). Com i = 0, PV / n. */
export function parcelaPrice(valor: number, jurosMensal: number, prazoMeses: number): number {
  if (jurosMensal === 0) return valor / prazoMeses
  return (valor * jurosMensal) / (1 - Math.pow(1 + jurosMensal, -prazoMeses))
}

/**
 * Taxa interna de retorno mensal: a taxa que iguala o valor recebido no mês 0
 * ao fluxo de pagamentos dos meses 1..n. Resolvida por bissecção.
 */
export function taxaInternaRetornoMensal(valorRecebido: number, pagamentos: number[]): number {
  const vpl = (r: number) =>
    valorRecebido - pagamentos.reduce((acc, pg, i) => acc + pg / Math.pow(1 + r, i + 1), 0)
  if (vpl(0) >= 0) return 0 // paga-se menos (ou igual) ao que se recebeu: taxa nula
  let baixo = 0
  let alto = 1
  while (vpl(alto) < 0) alto *= 2
  for (let k = 0; k < 200; k++) {
    const meio = (baixo + alto) / 2
    if (vpl(meio) < 0) baixo = meio
    else alto = meio
    if (alto - baixo < 1e-12) break
  }
  return (baixo + alto) / 2
}

export function simularFinanciamento(params: ParametrosFinanciamento): ResultadoFinanciamento {
  const p: ParametrosCompletos = {
    valorImovel: params.valorImovel,
    entrada: params.entrada,
    prazoMeses: params.prazoMeses,
    sistema: params.sistema,
    idade: params.idade ?? TAXAS_FINANCIAMENTO.idadePadrao,
    jurosAnual: params.jurosAnual ?? TAXAS_FINANCIAMENTO.jurosAnual,
    correcaoMensal: params.correcaoMensal ?? TAXAS_FINANCIAMENTO.correcaoMensal,
    dfiMensal: params.dfiMensal ?? TAXAS_FINANCIAMENTO.dfiMensal,
    taxaAdministracaoMensal:
      params.taxaAdministracaoMensal ?? TAXAS_FINANCIAMENTO.taxaAdministracaoMensal,
    mipPorIdade: params.mipPorIdade ?? TAXAS_FINANCIAMENTO.mipPorIdade,
  }
  validar(p)

  const valorFinanciado = p.valorImovel - p.entrada
  const i = jurosAnualParaMensal(p.jurosAnual)
  const n = p.prazoMeses

  let saldo = valorFinanciado
  // Sem correção do saldo, estes dois valores ficam constantes durante todo o contrato.
  let amortizacaoSac = valorFinanciado / n
  let parcelaFixaPrice = parcelaPrice(valorFinanciado, i, n)

  const parcelas: ParcelaFinanciamento[] = []

  for (let mes = 1; mes <= n; mes++) {
    const restantes = n - mes + 1

    // Correção monetária do saldo (TR): recalcula amortização/parcela sobre o saldo corrigido.
    if (p.correcaoMensal !== 0) {
      saldo *= 1 + p.correcaoMensal
      amortizacaoSac = saldo / restantes
      parcelaFixaPrice = parcelaPrice(saldo, i, restantes)
    }

    const idade = p.idade + Math.floor((mes - 1) / 12)
    const juros = saldo * i
    const amortizacao =
      p.sistema === 'SAC'
        ? Math.min(amortizacaoSac, saldo)
        : Math.min(parcelaFixaPrice - juros, saldo)
    const seguroMip = saldo * taxaMipPorIdade(idade, p.mipPorIdade)
    const seguroDfi = p.valorImovel * p.dfiMensal
    const taxaAdministracao = p.taxaAdministracaoMensal

    saldo -= amortizacao
    if (saldo < EPSILON) saldo = 0

    parcelas.push({
      mes,
      amortizacao,
      juros,
      seguroMip,
      seguroDfi,
      taxaAdministracao,
      parcela: amortizacao + juros + seguroMip + seguroDfi + taxaAdministracao,
      saldoDevedor: saldo,
      idade,
    })
  }

  const soma = (f: (x: ParcelaFinanciamento) => number) =>
    parcelas.reduce((acc, x) => acc + f(x), 0)
  const totalParcelas = soma((x) => x.parcela)
  const cetMensal = taxaInternaRetornoMensal(valorFinanciado, parcelas.map((x) => x.parcela))

  return {
    sistema: p.sistema,
    parcelas,
    valorFinanciado,
    jurosMensal: i,
    primeiraParcela: parcelas[0].parcela,
    ultimaParcela: parcelas[parcelas.length - 1].parcela,
    maiorParcela: Math.max(...parcelas.map((x) => x.parcela)),
    totalAmortizacao: soma((x) => x.amortizacao),
    totalJuros: soma((x) => x.juros),
    totalMip: soma((x) => x.seguroMip),
    totalDfi: soma((x) => x.seguroDfi),
    totalTaxaAdministracao: soma((x) => x.taxaAdministracao),
    totalParcelas,
    custoTotal: p.entrada + totalParcelas,
    cetAnual: Math.pow(1 + cetMensal, 12) - 1,
  }
}

/** Atalhos para quem só quer um sistema. */
export const simularSAC = (params: Omit<ParametrosFinanciamento, 'sistema'>) =>
  simularFinanciamento({ ...params, sistema: 'SAC' })
export const simularPrice = (params: Omit<ParametrosFinanciamento, 'sistema'>) =>
  simularFinanciamento({ ...params, sistema: 'PRICE' })

/** Maior parcela do contrato, útil para a validação de margem (RN01). */
export function parcelaMaximaFinanciamento(params: ParametrosFinanciamento): number {
  return simularFinanciamento(params).maiorParcela
}
