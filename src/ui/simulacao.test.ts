import { describe, expect, it } from 'vitest'
import type { TaxasAtuais } from '../services/bcb'
import { DADOS_INICIAIS, aplicarTaxasBcb, validar } from './simulacao'

const doBcb: TaxasAtuais = { jurosAnual: 0.115, inccAnual: 0.0617, fonte: { juros: 'bcb', incc: 'bcb' } }

describe('aplicarTaxasBcb (RF05)', () => {
  it('troca juros e INCC pelos valores do BCB, em %', () => {
    const d = aplicarTaxasBcb(DADOS_INICIAIS, doBcb)
    expect(d.jurosAnual).toBe(11.5)
    expect(d.inccAnual).toBe(6.17)
  })

  it('não sobrescreve um campo que o usuário já editou', () => {
    const editado = { ...DADOS_INICIAIS, jurosAnual: 9.5 }
    const d = aplicarTaxasBcb(editado, doBcb, new Set(['jurosAnual']))
    expect(d.jurosAnual).toBe(9.5)
    expect(d.inccAnual).toBe(6.17)
  })

  it('mantém o formulário quando a taxa veio do padrão local', () => {
    const padrao: TaxasAtuais = { ...doBcb, fonte: { juros: 'padrao', incc: 'padrao' } }
    expect(aplicarTaxasBcb(DADOS_INICIAIS, padrao)).toBe(DADOS_INICIAIS)
  })

  it('nunca deixa o INCC negativo (a validação exige >= 0)', () => {
    const deflacao: TaxasAtuais = { ...doBcb, inccAnual: -0.01 }
    expect(aplicarTaxasBcb(DADOS_INICIAIS, deflacao).inccAnual).toBe(0)
  })
})

describe('validar', () => {
  it('aceita os dados iniciais', () => {
    expect(validar(DADOS_INICIAIS)).toEqual({})
  })

  it('aponta prazo inválido no campo, antes de chamar os motores', () => {
    const e = validar({ ...DADOS_INICIAIS, prazoFinanciamento: 0, prazoConsorcio: 12.5 })
    expect(e.prazoFinanciamento).toBeDefined()
    expect(e.prazoConsorcio).toBeDefined()
  })

  it('exige entrada menor que o imóvel e idade mínima de 18 anos', () => {
    const e = validar({ ...DADOS_INICIAIS, entrada: 400_000, idade: 17 })
    expect(e.entrada).toBeDefined()
    expect(e.idade).toBeDefined()
  })
})
