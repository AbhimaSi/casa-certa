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

/** Faixa etária do seguro MIP: vale até `idadeMax` anos completos (inclusive). */
export interface FaixaMip {
  idadeMax: number
  /** Alíquota mensal sobre o saldo devedor (fração decimal). */
  taxa: number
}

/**
 * Taxas médias de mercado do financiamento imobiliário (SBPE / SFH).
 * Consultado em 2026-10-13 — conferir no simulador do banco antes da entrega final.
 *
 *  - jurosAnual: Caixa SBPE "a partir de TR + 10,99% a.a." (Agência Brasil, dez/2025).
 *  - correcaoMensal: TR aplicada ao saldo devedor; 0 = ignorar correção (simplificação).
 *  - dfiMensal: 0,01337% do valor do imóvel ao mês (exemplo Itaú citado pela Serasa).
 *  - mipPorIdade: tabela de uma seguradora real (TOO Seguros, publicada pela CCCPM/Marinha);
 *    a Caixa informa que a alíquota varia conforme a seguradora escolhida.
 *  - taxaAdministracaoMensal: tarifa fixa de administração do contrato, em R$.
 */
export const TAXAS_FINANCIAMENTO = {
  jurosAnual: 0.1099,
  correcaoMensal: 0,
  dfiMensal: 0.0001337,
  taxaAdministracaoMensal: 25,
  /** Idade padrão do comprador quando não informada (RF05 permite alterar). */
  idadePadrao: 30,
  mipPorIdade: [
    { idadeMax: 25, taxa: 0.00022866 },
    { idadeMax: 30, taxa: 0.00029256 },
    { idadeMax: 35, taxa: 0.00028933 },
    { idadeMax: 40, taxa: 0.00030896 },
    { idadeMax: 45, taxa: 0.00032617 },
    { idadeMax: 50, taxa: 0.00034423 },
    { idadeMax: 55, taxa: 0.00037127 },
    { idadeMax: 60, taxa: 0.00039172 },
    { idadeMax: 65, taxa: 0.00040322 },
    { idadeMax: 80, taxa: 0.00043928 },
  ] as readonly FaixaMip[],
} as const
