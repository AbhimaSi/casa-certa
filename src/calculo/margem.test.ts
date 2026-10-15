import { describe, expect, it } from 'vitest'
import { LIMITE_COMPROMETIMENTO_RENDA, avaliarMargem } from './margem'

describe('comprometimento de renda (RN01)', () => {
  it('limite padrão é 30% da renda', () => {
    expect(LIMITE_COMPROMETIMENTO_RENDA).toBe(0.3)
    expect(avaliarMargem(10_000, 2500).parcelaMaximaPermitida).toBe(3000)
  })

  it('parcela dentro do limite', () => {
    const a = avaliarMargem(10_000, 2500)
    expect(a.dentroDoLimite).toBe(true)
    expect(a.comprometimento).toBeCloseTo(0.25, 9)
    expect(a.excedente).toBe(0)
  })

  it('parcela exatamente no limite ainda é permitida', () => {
    expect(avaliarMargem(10_000, 3000).dentroDoLimite).toBe(true)
  })

  it('parcela acima do limite informa o excedente', () => {
    const a = avaliarMargem(10_000, 3500)
    expect(a.dentroDoLimite).toBe(false)
    expect(a.comprometimento).toBeCloseTo(0.35, 9)
    expect(a.excedente).toBe(500)
  })

  it('rejeita renda zero ou parcela negativa', () => {
    expect(() => avaliarMargem(0, 100)).toThrow(RangeError)
    expect(() => avaliarMargem(1000, -1)).toThrow(RangeError)
  })
})
