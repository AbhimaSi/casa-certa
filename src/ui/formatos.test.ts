import { describe, expect, it } from 'vitest'
import { abreviar, lerNumero } from './formatos'

describe('lerNumero (entrada em pt-BR)', () => {
  it.each([
    ['400.000,50', 400000.5],
    ['10,99', 10.99],
    ['400000', 400000],
    ['400.000', 400000],
    ['10.99', 10.99],
    ['R$ 1.500,00', 1500],
    ['', NaN],
    ['abc', NaN],
  ])('%s → %s', (texto, esperado) => {
    const v = lerNumero(texto)
    if (Number.isNaN(esperado)) expect(v).toBeNaN()
    else expect(v).toBeCloseTo(esperado, 6)
  })
})

describe('abreviar (rótulos de eixo)', () => {
  it('usa mil e mi', () => {
    expect(abreviar(0)).toBe('0')
    expect(abreviar(400_000)).toBe('400 mil')
    expect(abreviar(1_250_000)).toBe('1,3 mi')
  })
})
