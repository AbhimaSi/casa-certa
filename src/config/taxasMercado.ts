/**
 * Taxas médias de mercado usadas como padrão nas simulações (RNF04).
 * Trocar um valor aqui (ou trocar a fonte para a API SGS do Banco Central)
 * não exige alterar a lógica de cálculo.
 *
 * Todas as taxas são frações decimais: 0.06 = 6%.
 */
export const TAXAS_CONSORCIO = {
  /** Taxa de administração total do grupo, sobre o valor da carta. */
  taxaAdministracao: 0.16,
  /** Fundo de reserva total do grupo, sobre o valor da carta. */
  fundoReserva: 0.02,
  /** INCC acumulado em 12 meses, aplicado a cada aniversário do grupo. */
  inccAnual: 0.06,
} as const
