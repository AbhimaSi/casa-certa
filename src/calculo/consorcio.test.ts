import { describe, expect, it } from 'vitest'
import { TAXAS_CONSORCIO } from '../config/taxasMercado'
import { isMesReajuste, parcelaInicialConsorcio, simularConsorcio } from './consorcio'

const semTaxas = { taxaAdministracao: 0, fundoReserva: 0, inccAnual: 0 }

describe('composição da parcela (RN05)', () => {
  it('soma fundo comum + taxa de administração + fundo de reserva', () => {
    const r = simularConsorcio({
      valorCarta: 120_000,
      prazoMeses: 120,
      taxaAdministracao: 0.12,
      fundoReserva: 0.02,
      inccAnual: 0,
    })
    const p = r.parcelas[0]
    expect(p.fundoComum).toBeCloseTo(1000, 6)
    expect(p.taxaAdministracao).toBeCloseTo(120, 6)
    expect(p.fundoReserva).toBeCloseTo(20, 6)
    expect(p.parcela).toBeCloseTo(1140, 6)
    expect(r.ultimaParcela).toBeCloseTo(1140, 6)
    expect(r.prazoEfetivo).toBe(120)
    expect(r.custoTotal).toBeCloseTo(136_800, 4)
    expect(r.totalFundoComum).toBeCloseTo(120_000, 4)
    expect(r.parcelas.at(-1)!.saldoDevedor).toBe(0)
  })

  it('concentra a taxa de administração antecipada nos primeiros meses', () => {
    const r = simularConsorcio({
      valorCarta: 12_000,
      prazoMeses: 12,
      taxaAdministracao: 0.12,
      fundoReserva: 0,
      inccAnual: 0,
      taxaAdmAntecipada: 0.03,
      mesesAntecipacao: 3,
    })
    expect(r.parcelas[0].taxaAdministracao).toBeCloseTo(90 + 120, 6)
    expect(r.parcelas[2].taxaAdministracao).toBeCloseTo(210, 6)
    expect(r.parcelas[3].taxaAdministracao).toBeCloseTo(90, 6)
    expect(r.totalTaxaAdministracao).toBeCloseTo(1440, 6)
  })

  it('usa as taxas de mercado da configuração como padrão (RNF04)', () => {
    const r = simularConsorcio({ valorCarta: 100_000, prazoMeses: 100 })
    const esperado = 1000 * (1 + TAXAS_CONSORCIO.taxaAdministracao + TAXAS_CONSORCIO.fundoReserva)
    expect(r.primeiraParcela).toBeCloseTo(esperado, 6)
    expect(parcelaInicialConsorcio({ valorCarta: 100_000, prazoMeses: 100 })).toBeCloseTo(esperado, 6)
  })
})

describe('reajuste anual pelo INCC (RN06)', () => {
  it('identifica os meses de aniversário do grupo', () => {
    expect([1, 12, 13, 24, 25, 37].map(isMesReajuste)).toEqual([false, false, true, false, true, true])
  })

  it('corrige saldo devedor, parcelas e carta a cada 12 meses', () => {
    const r = simularConsorcio({ valorCarta: 24_000, prazoMeses: 24, ...semTaxas, inccAnual: 0.1 })
    expect(r.parcelas[11].parcela).toBeCloseTo(1000, 6)
    expect(r.parcelas[11].saldoDevedor).toBeCloseTo(12_000, 6)
    expect(r.parcelas[12].reajustado).toBe(true)
    expect(r.parcelas[12].parcela).toBeCloseTo(1100, 6)
    expect(r.ultimaParcela).toBeCloseTo(1100, 6)
    expect(r.custoTotal).toBeCloseTo(25_200, 4)
    expect(r.valorCartaFinal).toBeCloseTo(26_400, 6)
  })

  it('acumula o reajuste de forma composta', () => {
    const r = simularConsorcio({ valorCarta: 36_000, prazoMeses: 36, ...semTaxas, inccAnual: 0.1 })
    expect(r.parcelas[24].parcela).toBeCloseTo(1000 * 1.1 * 1.1, 6)
    expect(r.valorCartaFinal).toBeCloseTo(36_000 * 1.21, 6)
  })

  it('não altera nada com INCC zero', () => {
    const r = simularConsorcio({ valorCarta: 24_000, prazoMeses: 24, ...semTaxas })
    expect(r.parcelas.every((p) => !p.reajustado)).toBe(true)
    expect(r.custoTotal).toBeCloseTo(24_000, 6)
  })
})

describe('lances (RN07)', () => {
  const base = { valorCarta: 12_000, prazoMeses: 12, ...semTaxas }

  it('reduzir parcela: mantém o prazo e recalcula as parcelas seguintes', () => {
    const r = simularConsorcio({ ...base, lances: [{ mes: 6, valor: 3000, modo: 'reduzirParcela' }] })
    expect(r.prazoEfetivo).toBe(12)
    expect(r.parcelas[5].lance).toBe(3000)
    expect(r.parcelas[5].saldoDevedor).toBeCloseTo(3000, 6)
    expect(r.parcelas[6].parcela).toBeCloseTo(500, 6)
    expect(r.totalLances).toBe(3000)
    expect(r.custoTotal).toBeCloseTo(12_000, 6)
  })

  it('reduzir prazo: mantém a parcela e encurta o prazo', () => {
    const r = simularConsorcio({ ...base, lances: [{ mes: 6, valor: 3000, modo: 'reduzirPrazo' }] })
    expect(r.prazoEfetivo).toBe(9)
    expect(r.parcelas[8].parcela).toBeCloseTo(1000, 6)
    expect(r.custoTotal).toBeCloseTo(12_000, 6)
  })

  it('reduzir prazo com saldo não múltiplo da parcela arredonda o prazo para cima', () => {
    const r = simularConsorcio({ ...base, lances: [{ mes: 6, valor: 2500, modo: 'reduzirPrazo' }] })
    expect(r.prazoEfetivo).toBe(10)
    expect(r.parcelas[6].parcela).toBeCloseTo(875, 6)
    expect(r.parcelas[6].parcela).toBeLessThanOrEqual(1000)
    expect(r.custoTotal).toBeCloseTo(12_000, 6)
  })

  it('lance maior que o saldo quita o consórcio e é limitado ao saldo', () => {
    const r = simularConsorcio({ ...base, lances: [{ mes: 3, valor: 1_000_000, modo: 'reduzirPrazo' }] })
    expect(r.prazoEfetivo).toBe(3)
    expect(r.totalLances).toBeCloseTo(9000, 6)
    expect(r.parcelas.at(-1)!.saldoDevedor).toBe(0)
  })

  it('abate taxas e fundo de reserva proporcionalmente', () => {
    const r = simularConsorcio({
      valorCarta: 10_000,
      prazoMeses: 10,
      taxaAdministracao: 0.1,
      fundoReserva: 0,
      inccAnual: 0,
      lances: [{ mes: 5, valor: 2750, modo: 'reduzirParcela' }],
    })
    // Saldo após mês 5: 5000 FC + 500 TA = 5500; lance de 50% → 2500 FC + 250 TA.
    expect(r.parcelas[5].fundoComum).toBeCloseTo(500, 6)
    expect(r.parcelas[5].taxaAdministracao).toBeCloseTo(50, 6)
    expect(r.custoTotal).toBeCloseTo(11_000, 6)
  })

  it('lance combinado com reajuste INCC', () => {
    const r = simularConsorcio({
      valorCarta: 24_000,
      prazoMeses: 24,
      ...semTaxas,
      inccAnual: 0.1,
      lances: [{ mes: 12, valor: 6000, modo: 'reduzirParcela' }],
    })
    // Saldo 12000 - 6000 = 6000, reajustado para 6600 / 12 meses.
    expect(r.parcelas[12].parcela).toBeCloseTo(550, 6)
    expect(r.totalParcelas).toBeCloseTo(12_000 + 6600, 6)
  })
})

describe('validação de entradas', () => {
  it.each([
    [{ valorCarta: 0, prazoMeses: 12 }],
    [{ valorCarta: 1000, prazoMeses: 0 }],
    [{ valorCarta: 1000, prazoMeses: 12.5 }],
    [{ valorCarta: 1000, prazoMeses: 12, taxaAdministracao: -0.1 }],
    [{ valorCarta: 1000, prazoMeses: 12, taxaAdmAntecipada: 0.5 }],
    [{ valorCarta: 1000, prazoMeses: 12, taxaAdmAntecipada: 0.01 }],
    [{ valorCarta: 1000, prazoMeses: 12, lances: [{ mes: 13, valor: 10, modo: 'reduzirPrazo' as const }] }],
    [{ valorCarta: 1000, prazoMeses: 12, lances: [{ mes: 2, valor: 0, modo: 'reduzirPrazo' as const }] }],
  ])('rejeita parâmetros inválidos %#', (params) => {
    expect(() => simularConsorcio(params)).toThrow(RangeError)
  })
})
