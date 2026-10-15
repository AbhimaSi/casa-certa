import { describe, expect, it } from 'vitest'
import { TAXAS_FINANCIAMENTO } from '../config/taxasMercado'
import {
  jurosAnualParaMensal,
  parcelaMaximaFinanciamento,
  parcelaPrice,
  simularFinanciamento,
  simularPrice,
  simularSAC,
  taxaInternaRetornoMensal,
  taxaMipPorIdade,
} from './financiamento'

/** Taxa anual cujo equivalente mensal é exatamente 1% — deixa as contas conferíveis à mão. */
const JUROS_1_AO_MES = Math.pow(1.01, 12) - 1

/** Zera seguros e tarifa para isolar amortização + juros. */
const semExtras = {
  dfiMensal: 0,
  taxaAdministracaoMensal: 0,
  mipPorIdade: [{ idadeMax: 200, taxa: 0 }],
}

/** Imóvel de 120 mil com 20 mil de entrada: 100 mil financiados em 100 meses a 1% a.m. */
const base = { valorImovel: 120_000, entrada: 20_000, prazoMeses: 100, jurosAnual: JUROS_1_AO_MES, ...semExtras }

describe('conversões e fórmulas de apoio', () => {
  it('converte juros anual em mensal por equivalência composta', () => {
    expect(jurosAnualParaMensal(JUROS_1_AO_MES)).toBeCloseTo(0.01, 12)
    expect(jurosAnualParaMensal(0)).toBe(0)
  })

  it('calcula a parcela fixa da Price pela fórmula fechada', () => {
    expect(parcelaPrice(100_000, 0.01, 100)).toBeCloseTo(1586.57, 1)
    expect(parcelaPrice(100_000, 0, 100)).toBe(1000)
  })

  it('escolhe a alíquota do MIP pela faixa etária', () => {
    expect(taxaMipPorIdade(18)).toBe(0.00022866)
    expect(taxaMipPorIdade(25)).toBe(0.00022866)
    expect(taxaMipPorIdade(26)).toBe(0.00029256)
    expect(taxaMipPorIdade(80)).toBe(0.00043928)
    expect(taxaMipPorIdade(90)).toBe(0.00043928) // acima da tabela: última faixa
  })

  it('encontra a taxa interna de retorno mensal', () => {
    expect(taxaInternaRetornoMensal(1000, [1010])).toBeCloseTo(0.01, 10)
    expect(taxaInternaRetornoMensal(1000, [500, 500])).toBe(0)
  })
})

describe('sistema SAC (RN02)', () => {
  const r = simularSAC(base)

  it('amortização constante e juros sobre o saldo devedor', () => {
    expect(r.valorFinanciado).toBe(100_000)
    expect(r.parcelas).toHaveLength(100)
    expect(r.parcelas.every((p) => Math.abs(p.amortizacao - 1000) < 1e-9)).toBe(true)
    expect(r.parcelas[0].juros).toBeCloseTo(1000, 6)
    expect(r.parcelas[0].saldoDevedor).toBeCloseTo(99_000, 6)
    expect(r.parcelas[1].juros).toBeCloseTo(990, 6)
    expect(r.parcelas.at(-1)!.juros).toBeCloseTo(10, 6)
    expect(r.parcelas.at(-1)!.saldoDevedor).toBe(0)
  })

  it('parcelas decrescentes: primeira é a maior, última é a menor', () => {
    expect(r.primeiraParcela).toBeCloseTo(2000, 6)
    expect(r.ultimaParcela).toBeCloseTo(1010, 6)
    expect(r.maiorParcela).toBeCloseTo(2000, 6)
    for (let k = 1; k < r.parcelas.length; k++) {
      expect(r.parcelas[k].parcela).toBeLessThan(r.parcelas[k - 1].parcela)
    }
  })

  it('totais conferem com a soma da PA dos juros (1% de 100 + 99 + ... + 1 mil)', () => {
    expect(r.totalAmortizacao).toBeCloseTo(100_000, 4)
    expect(r.totalJuros).toBeCloseTo(50_500, 4)
    expect(r.totalParcelas).toBeCloseTo(150_500, 4)
    expect(r.custoTotal).toBeCloseTo(170_500, 4) // entrada + parcelas
  })

  it('sem seguros nem tarifa, o CET é a própria taxa de juros', () => {
    expect(r.cetAnual).toBeCloseTo(JUROS_1_AO_MES, 8)
  })
})

describe('sistema Price (RN03)', () => {
  const r = simularPrice(base)
  const pmt = parcelaPrice(100_000, 0.01, 100)

  it('parcela fixa do início ao fim', () => {
    expect(r.parcelas.every((p) => Math.abs(p.parcela - pmt) < 1e-6)).toBe(true)
    expect(r.primeiraParcela).toBeCloseTo(r.ultimaParcela, 6)
    expect(r.maiorParcela).toBeCloseTo(pmt, 6)
  })

  it('amortização crescente e juros decrescentes', () => {
    expect(r.parcelas[0].juros).toBeCloseTo(1000, 6)
    expect(r.parcelas[0].amortizacao).toBeCloseTo(pmt - 1000, 6)
    for (let k = 1; k < r.parcelas.length; k++) {
      expect(r.parcelas[k].amortizacao).toBeGreaterThan(r.parcelas[k - 1].amortizacao)
      expect(r.parcelas[k].juros).toBeLessThan(r.parcelas[k - 1].juros)
    }
    expect(r.parcelas.at(-1)!.saldoDevedor).toBe(0)
  })

  it('totais fecham com a parcela fixa', () => {
    expect(r.totalAmortizacao).toBeCloseTo(100_000, 4)
    expect(r.totalJuros).toBeCloseTo(100 * pmt - 100_000, 4)
    expect(r.cetAnual).toBeCloseTo(JUROS_1_AO_MES, 8)
  })
})

describe('SAC versus Price', () => {
  const sac = simularSAC(base)
  const price = simularPrice(base)

  it('SAC começa mais alto, termina mais baixo e paga menos juros no total', () => {
    expect(sac.primeiraParcela).toBeGreaterThan(price.primeiraParcela)
    expect(sac.ultimaParcela).toBeLessThan(price.ultimaParcela)
    expect(sac.totalJuros).toBeLessThan(price.totalJuros)
  })

  it('com juros zero os dois sistemas são idênticos', () => {
    const s = simularSAC({ ...base, jurosAnual: 0 })
    const p = simularPrice({ ...base, jurosAnual: 0 })
    expect(s.parcelas.every((x) => Math.abs(x.parcela - 1000) < 1e-9)).toBe(true)
    expect(p.parcelas.every((x) => Math.abs(x.parcela - 1000) < 1e-9)).toBe(true)
    expect(s.cetAnual).toBe(0)
  })
})

describe('composição da parcela (RN04) e seguros', () => {
  it('soma amortização + juros + MIP + DFI + tarifa', () => {
    const r = simularSAC({
      valorImovel: 200_000,
      entrada: 0,
      prazoMeses: 10,
      jurosAnual: 0,
      idade: 28,
      dfiMensal: 0.0001337,
      taxaAdministracaoMensal: 25,
    })
    const p = r.parcelas[0]
    expect(p.amortizacao).toBeCloseTo(20_000, 6)
    expect(p.juros).toBe(0)
    expect(p.seguroMip).toBeCloseTo(200_000 * 0.00029256, 6) // faixa 26-30 sobre o saldo
    expect(p.seguroDfi).toBeCloseTo(200_000 * 0.0001337, 6) // sobre o valor do imóvel
    expect(p.taxaAdministracao).toBe(25)
    expect(p.parcela).toBeCloseTo(20_000 + 58.512 + 26.74 + 25, 6)
    // MIP cai com o saldo; DFI e tarifa ficam constantes.
    expect(r.parcelas[1].seguroMip).toBeCloseTo(180_000 * 0.00029256, 6)
    expect(r.totalDfi).toBeCloseTo(267.4, 6)
    expect(r.totalTaxaAdministracao).toBe(250)
  })

  it('a idade avança a cada 12 meses e muda a faixa do MIP (RF05)', () => {
    const r = simularSAC({
      valorImovel: 24_000,
      entrada: 0,
      prazoMeses: 24,
      jurosAnual: 0,
      idade: 25,
      dfiMensal: 0,
      taxaAdministracaoMensal: 0,
    })
    expect(r.parcelas[11].idade).toBe(25)
    expect(r.parcelas[11].seguroMip).toBeCloseTo(13_000 * 0.00022866, 9)
    expect(r.parcelas[12].idade).toBe(26)
    expect(r.parcelas[12].seguroMip).toBeCloseTo(12_000 * 0.00029256, 9)
  })

  it('seguros e tarifa elevam o CET acima da taxa de juros (RF03)', () => {
    const r = simularPrice({ valorImovel: 300_000, entrada: 60_000, prazoMeses: 360, idade: 35 })
    expect(r.cetAnual).toBeGreaterThan(TAXAS_FINANCIAMENTO.jurosAnual)
    expect(r.cetAnual).toBeLessThan(TAXAS_FINANCIAMENTO.jurosAnual + 0.02)
  })
})

describe('correção do saldo (TR)', () => {
  it('corrige o saldo antes dos juros e recalcula a amortização', () => {
    const r = simularSAC({
      valorImovel: 1000,
      entrada: 0,
      prazoMeses: 2,
      jurosAnual: 0,
      correcaoMensal: 0.01,
      ...semExtras,
    })
    expect(r.parcelas[0].amortizacao).toBeCloseTo(505, 6) // 1010 / 2
    expect(r.parcelas[0].saldoDevedor).toBeCloseTo(505, 6)
    expect(r.parcelas[1].amortizacao).toBeCloseTo(510.05, 6) // 505 * 1.01
    expect(r.parcelas[1].saldoDevedor).toBe(0)
    expect(r.totalAmortizacao).toBeCloseTo(1015.05, 6)
  })
})

describe('padrões de mercado e atalhos', () => {
  it('usa as taxas de mercado da configuração como padrão (RNF04)', () => {
    const r = simularFinanciamento({ valorImovel: 300_000, entrada: 60_000, prazoMeses: 360, sistema: 'SAC' })
    expect(r.jurosMensal).toBeCloseTo(jurosAnualParaMensal(TAXAS_FINANCIAMENTO.jurosAnual), 12)
    expect(r.parcelas[0].taxaAdministracao).toBe(TAXAS_FINANCIAMENTO.taxaAdministracaoMensal)
    expect(r.parcelas[0].idade).toBe(TAXAS_FINANCIAMENTO.idadePadrao)
    expect(r.parcelas[0].seguroDfi).toBeCloseTo(300_000 * TAXAS_FINANCIAMENTO.dfiMensal, 9)
  })

  it('parcela máxima para a regra dos 30% é a primeira no SAC e a fixa na Price', () => {
    expect(parcelaMaximaFinanciamento({ ...base, sistema: 'SAC' })).toBeCloseTo(2000, 6)
    expect(parcelaMaximaFinanciamento({ ...base, sistema: 'PRICE' })).toBeCloseTo(parcelaPrice(100_000, 0.01, 100), 6)
  })
})

describe('validação de entradas', () => {
  it.each([
    [{ valorImovel: 0, entrada: 0, prazoMeses: 12, sistema: 'SAC' as const }],
    [{ valorImovel: 1000, entrada: 1000, prazoMeses: 12, sistema: 'SAC' as const }],
    [{ valorImovel: 1000, entrada: -1, prazoMeses: 12, sistema: 'SAC' as const }],
    [{ valorImovel: 1000, entrada: 0, prazoMeses: 0, sistema: 'SAC' as const }],
    [{ valorImovel: 1000, entrada: 0, prazoMeses: 12.5, sistema: 'PRICE' as const }],
    [{ valorImovel: 1000, entrada: 0, prazoMeses: 12, sistema: 'XYZ' as unknown as 'SAC' }],
    [{ valorImovel: 1000, entrada: 0, prazoMeses: 12, sistema: 'SAC' as const, idade: 17 }],
    [{ valorImovel: 1000, entrada: 0, prazoMeses: 12, sistema: 'SAC' as const, jurosAnual: -0.1 }],
    [{ valorImovel: 1000, entrada: 0, prazoMeses: 12, sistema: 'SAC' as const, mipPorIdade: [] }],
  ])('rejeita parâmetros inválidos %#', (params) => {
    expect(() => simularFinanciamento(params)).toThrow(RangeError)
  })
})
