/**
 * Formatação e leitura de números em pt-BR (RNF01: máscara monetária).
 */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const BRL0 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

/** R$ 1.234,56 */
export const brl = (v: number) => BRL.format(v)
/** R$ 1.235 (sem centavos, para cartões e gráficos) */
export const brl0 = (v: number) => BRL0.format(v)
/** 1.234,56 (sem o símbolo) */
export const num2 = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** 0.1234 → "12,3%" */
export const pct = (v: number, casas = 1) =>
  (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%'

/** Abrevia valores de eixo: 400000 → "400 mil", 1250000 → "1,3 mi". */
export function abreviar(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi'
  return Math.round(v / 1000) + ' mil'
}

/**
 * Lê texto digitado em pt-BR e devolve número (NaN se vazio ou inválido).
 *  "400.000,50" → 400000.5 · "10,99" → 10.99 · "400000" → 400000 · "10.99" → 10.99
 */
export function lerNumero(texto: string): number {
  const t = String(texto).replace(/[^\d,.-]/g, '')
  if (!t) return NaN
  if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.'))
  const pontos = t.split('.')
  // Um único ponto seguido de 1 ou 2 dígitos é separador decimal (ex.: "10.99"); senão é milhar.
  if (pontos.length === 2 && pontos[1].length > 0 && pontos[1].length < 3) return parseFloat(t)
  return parseFloat(t.replace(/\./g, ''))
}
