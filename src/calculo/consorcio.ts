/**
 * Motor de cálculo do consórcio imobiliário.
 *
 * Funções puras, sem dependência de interface (ver Seção 3.3 do documento da Fase 1).
 * Regras atendidas:
 *  - RN05: parcela = fundo comum + taxa de administração (inclusive antecipada) + fundo de reserva
 *  - RN06: saldo devedor e parcelas reajustados a cada 12 meses pelo INCC
 *  - RN07: lance livre reduz o saldo devedor, reduzindo o prazo ou a parcela
 *
 * Todas as taxas são frações decimais (0.06 = 6%). Valores monetários em R$, sem arredondamento
 * interno — arredonde apenas na exibição.
 */
import { TAXAS_CONSORCIO } from '../config/taxasMercado'

export type ModoLance = 'reduzirPrazo' | 'reduzirParcela'

export interface Lance {
  /** Mês em que o lance é ofertado (pago após a parcela desse mês). */
  mes: number
  /** Valor do lance em R$. Valores acima do saldo devedor são limitados ao saldo. */
  valor: number
  modo: ModoLance
}

export interface ParametrosConsorcio {
  /** Valor da carta de crédito (valor do imóvel) em R$. */
  valorCarta: number
  /** Prazo do grupo em meses. */
  prazoMeses: number
  /** Taxa de administração total sobre a carta. Padrão: config de mercado. */
  taxaAdministracao?: number
  /** Fundo de reserva total sobre a carta. Padrão: config de mercado. */
  fundoReserva?: number
  /** INCC anual aplicado a cada 12 meses. Padrão: config de mercado. */
  inccAnual?: number
  /**
   * Parte da taxa de administração cobrada antecipadamente (fração da carta),
   * concentrada nos primeiros `mesesAntecipacao` meses. Já está contida em `taxaAdministracao`.
   */
  taxaAdmAntecipada?: number
  mesesAntecipacao?: number
  lances?: Lance[]
}

export interface ParcelaConsorcio {
  mes: number
  fundoComum: number
  taxaAdministracao: number
  fundoReserva: number
  parcela: number
  /** Lance pago neste mês (0 se não houve). */
  lance: number
  /** Saldo devedor após a parcela e o lance do mês. */
  saldoDevedor: number
  /** Valor da carta de crédito corrigido pelo INCC até este mês. */
  valorCarta: number
  /** Indica que houve reajuste INCC no início deste mês. */
  reajustado: boolean
}

export interface ResultadoConsorcio {
  parcelas: ParcelaConsorcio[]
  prazoEfetivo: number
  primeiraParcela: number
  ultimaParcela: number
  totalParcelas: number
  totalLances: number
  /** Total desembolsado (parcelas + lances): base do CET do consórcio. */
  custoTotal: number
  totalFundoComum: number
  totalTaxaAdministracao: number
  totalFundoReserva: number
  /** Valor da carta corrigido ao final do prazo. */
  valorCartaFinal: number
}

const EPSILON = 1e-6

function validar(p: Required<Omit<ParametrosConsorcio, 'lances'>> & { lances: Lance[] }) {
  if (!(p.valorCarta > 0)) throw new RangeError('valorCarta deve ser maior que zero')
  if (!Number.isInteger(p.prazoMeses) || p.prazoMeses <= 0)
    throw new RangeError('prazoMeses deve ser um inteiro positivo')
  if (p.taxaAdministracao < 0) throw new RangeError('taxaAdministracao não pode ser negativa')
  if (p.fundoReserva < 0) throw new RangeError('fundoReserva não pode ser negativo')
  if (p.inccAnual <= -1) throw new RangeError('inccAnual deve ser maior que -100%')
  if (p.taxaAdmAntecipada < 0 || p.taxaAdmAntecipada > p.taxaAdministracao)
    throw new RangeError('taxaAdmAntecipada deve estar entre 0 e taxaAdministracao')
  if (!Number.isInteger(p.mesesAntecipacao) || p.mesesAntecipacao < 0 || p.mesesAntecipacao > p.prazoMeses)
    throw new RangeError('mesesAntecipacao deve ser um inteiro entre 0 e prazoMeses')
  if (p.taxaAdmAntecipada > 0 && p.mesesAntecipacao === 0)
    throw new RangeError('mesesAntecipacao deve ser informado quando há taxa antecipada')
  for (const l of p.lances) {
    if (!Number.isInteger(l.mes) || l.mes < 1 || l.mes > p.prazoMeses)
      throw new RangeError(`lance com mês inválido: ${l.mes}`)
    if (!(l.valor > 0)) throw new RangeError('valor do lance deve ser maior que zero')
  }
}

/** Mês em que ocorre reajuste: início de cada novo ano do grupo (13, 25, 37...). */
export function isMesReajuste(mes: number): boolean {
  return mes > 1 && (mes - 1) % 12 === 0
}

/** Parcela inicial (sem reajuste, sem lances), útil para validação de margem (RN01). */
export function parcelaInicialConsorcio(params: ParametrosConsorcio): number {
  return simularConsorcio({ ...params, lances: [] }).primeiraParcela
}

export function simularConsorcio(params: ParametrosConsorcio): ResultadoConsorcio {
  const p = {
    valorCarta: params.valorCarta,
    prazoMeses: params.prazoMeses,
    taxaAdministracao: params.taxaAdministracao ?? TAXAS_CONSORCIO.taxaAdministracao,
    fundoReserva: params.fundoReserva ?? TAXAS_CONSORCIO.fundoReserva,
    inccAnual: params.inccAnual ?? TAXAS_CONSORCIO.inccAnual,
    taxaAdmAntecipada: params.taxaAdmAntecipada ?? 0,
    mesesAntecipacao: params.mesesAntecipacao ?? 0,
    lances: params.lances ?? [],
  }
  validar(p)

  // Saldos a pagar de cada componente (em R$).
  let saldoFC = p.valorCarta
  let saldoTA = p.valorCarta * (p.taxaAdministracao - p.taxaAdmAntecipada)
  let saldoAntecipada = p.valorCarta * p.taxaAdmAntecipada
  let saldoFR = p.valorCarta * p.fundoReserva
  let valorCarta = p.valorCarta
  let prazo = p.prazoMeses

  const lancesPorMes = new Map<number, Lance[]>()
  for (const l of p.lances) lancesPorMes.set(l.mes, [...(lancesPorMes.get(l.mes) ?? []), l])

  const parcelas: ParcelaConsorcio[] = []

  for (let mes = 1; mes <= prazo; mes++) {
    const reajustado = isMesReajuste(mes) && p.inccAnual !== 0
    if (reajustado) {
      const f = 1 + p.inccAnual
      saldoFC *= f
      saldoTA *= f
      saldoAntecipada *= f
      saldoFR *= f
      valorCarta *= f
    }

    const restantes = prazo - mes + 1
    const fundoComum = saldoFC / restantes
    const taxaRegular = saldoTA / restantes
    const fundoReserva = saldoFR / restantes
    let taxaAntecipada = 0
    if (mes <= p.mesesAntecipacao) {
      taxaAntecipada = saldoAntecipada / (p.mesesAntecipacao - mes + 1)
      saldoAntecipada -= taxaAntecipada
    }

    saldoFC -= fundoComum
    saldoTA -= taxaRegular
    saldoFR -= fundoReserva

    // Lances (RN07): abatem o saldo devedor proporcionalmente entre os componentes.
    let lanceMes = 0
    for (const lance of lancesPorMes.get(mes) ?? []) {
      const saldoRegular = saldoFC + saldoTA + saldoFR
      if (saldoRegular <= EPSILON) break
      const valor = Math.min(lance.valor, saldoRegular)
      const fator = 1 - valor / saldoRegular
      saldoFC *= fator
      saldoTA *= fator
      saldoFR *= fator
      lanceMes += valor

      if (lance.modo === 'reduzirPrazo') {
        // Mantém o valor da parcela regular e encurta o prazo restante.
        const parcelaRegular = fundoComum + taxaRegular + fundoReserva
        const novosRestantes = Math.ceil(saldoFC + saldoTA + saldoFR > EPSILON
          ? (saldoFC + saldoTA + saldoFR) / parcelaRegular - EPSILON
          : 0)
        prazo = Math.max(mes + novosRestantes, Math.min(prazo, p.mesesAntecipacao))
      }
      // reduzirParcela: o prazo é mantido; a próxima parcela é recalculada sobre o saldo menor.
    }

    const saldoDevedor = saldoFC + saldoTA + saldoFR + saldoAntecipada
    parcelas.push({
      mes,
      fundoComum,
      taxaAdministracao: taxaRegular + taxaAntecipada,
      fundoReserva,
      parcela: fundoComum + taxaRegular + taxaAntecipada + fundoReserva,
      lance: lanceMes,
      saldoDevedor: saldoDevedor < EPSILON ? 0 : saldoDevedor,
      valorCarta,
      reajustado,
    })

    if (saldoDevedor < EPSILON) break
  }

  const soma = (f: (x: ParcelaConsorcio) => number) => parcelas.reduce((acc, x) => acc + f(x), 0)
  const totalParcelas = soma((x) => x.parcela)
  const totalLances = soma((x) => x.lance)
  const ultimaComParcela = [...parcelas].reverse().find((x) => x.parcela > EPSILON)

  return {
    parcelas,
    prazoEfetivo: parcelas.length,
    primeiraParcela: parcelas[0].parcela,
    ultimaParcela: ultimaComParcela?.parcela ?? 0,
    totalParcelas,
    totalLances,
    custoTotal: totalParcelas + totalLances,
    totalFundoComum: soma((x) => x.fundoComum),
    totalTaxaAdministracao: soma((x) => x.taxaAdministracao),
    totalFundoReserva: soma((x) => x.fundoReserva),
    valorCartaFinal: valorCarta,
  }
}
