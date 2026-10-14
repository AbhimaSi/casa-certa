/**
 * Regra de comprometimento de renda (RN01 / RF02): a parcela não pode ultrapassar
 * 30% da renda mensal bruta familiar. Função pura, compartilhada entre as modalidades.
 */
export const LIMITE_COMPROMETIMENTO_RENDA = 0.3

export interface AvaliacaoMargem {
  rendaMensal: number
  parcela: number
  /** Valor máximo de parcela permitido para a renda informada. */
  parcelaMaximaPermitida: number
  /** Fração da renda comprometida pela parcela (0.25 = 25%). */
  comprometimento: number
  /** Quanto a parcela excede o limite (0 quando está dentro). */
  excedente: number
  dentroDoLimite: boolean
}

export function avaliarMargem(
  rendaMensal: number,
  parcela: number,
  limite: number = LIMITE_COMPROMETIMENTO_RENDA,
): AvaliacaoMargem {
  if (!(rendaMensal > 0)) throw new RangeError('rendaMensal deve ser maior que zero')
  if (!(parcela >= 0)) throw new RangeError('parcela não pode ser negativa')
  const parcelaMaximaPermitida = rendaMensal * limite
  return {
    rendaMensal,
    parcela,
    parcelaMaximaPermitida,
    comprometimento: parcela / rendaMensal,
    excedente: Math.max(0, parcela - parcelaMaximaPermitida),
    dentroDoLimite: parcela <= parcelaMaximaPermitida,
  }
}
