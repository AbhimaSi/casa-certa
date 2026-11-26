/**
 * bcb.ts — Cliente da API SGS do Banco Central (juros do financiamento imobiliário e INCC)
 *
 * Referências ao documento de requisitos (CasaCerta — Fase 1):
 *  - RNF04 (Manutenibilidade): as taxas de mercado ficam isoladas deste módulo e
 *    do arquivo config/taxasMercado; trocar a fonte (constante -> API) não toca
 *    a lógica de cálculo.
 *  - RNF03 (Portabilidade/offline): se a API falhar ou não houver internet, o
 *    módulo devolve as constantes locais como fallback, e a simulação continua.
 *  - RF05 (Configurações avançadas): a taxa de juros anual obtida aqui é apenas
 *    o VALOR INICIAL do campo; o usuário pode sobrescrevê-la manualmente.
 *  - RN02 / RN03 (SAC e Price): `jurosAnual` alimenta o cálculo de juros dos dois
 *    sistemas de amortização do financiamento.
 *  - RN06 (Reajuste do consórcio): `inccAnual` é o índice usado para reajustar
 *    saldo devedor e parcelas a cada 12 meses.
 *  - RNF02 (Desempenho): a simulação nunca deve esperar pela rede. A UI começa
 *    com `obterTaxasPadrao()` (síncrono) e atualiza quando `obterTaxasAtuais()`
 *    resolver; a busca tem timeout curto (5 s).
 */

import { TAXAS_CONSORCIO, TAXAS_FINANCIAMENTO } from '../config/taxasMercado'

/** Formato de cada registro devolvido pela API SGS */
interface RegistroSgs {
  data: string
  valor: string
}

/** Taxas prontas para uso pelos motores de cálculo (valores em decimal: 0,10 = 10%). */
export interface TaxasAtuais {
  /** Taxa de juros anual do financiamento (RN02/RN03). */
  jurosAnual: number
  /** Reajuste anual do consórcio pelo INCC (RN06). */
  inccAnual: number
  /** Útil para mostrar na UI se os dados são ao vivo ou padrão. */
  fonte: {
    juros: 'bcb' | 'padrao'
    incc: 'bcb' | 'padrao'
  }
}

/** Tempo máximo de espera por requisição, para não travar a interface (RNF02). */
const TIMEOUT_MS = 5000

/** Validade do cache: depois disso a taxa é buscada de novo no BCB. */
const TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

/**
 * Busca os últimos `ultimos` registros de uma série do SGS.
 * Lança erro em caso de timeout, falha de rede, status HTTP diferente de 2xx
 * ou resposta fora do formato esperado.
 */
async function fetchSgs(codigo: number, ultimos: number): Promise<RegistroSgs[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/${ultimos}?formato=json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`SGS ${codigo}: HTTP ${res.status}`)
    const dados: unknown = await res.json()
    if (!Array.isArray(dados)) throw new Error(`SGS ${codigo}: resposta inesperada`)
    return dados as RegistroSgs[]
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Converte o `valor` (string) do SGS em número.
 */
function parseValorSgs(bruto: unknown): number {
  if (typeof bruto !== 'string' || bruto.trim() === '') return NaN
  return Number(bruto)
}

/**
 * Série 20772 = taxa média de juros do financiamento imobiliário com taxas de mercado,
 * pessoas físicas (% a.a.). É a taxa que os bancos cobram no crédito imobiliário,
 * diferente da Selic (série 432), que é a taxa básica da economia e não serve aqui.
 * Retorna o último valor como decimal (ex.: 11,5 -> 0,115). Rejeita valores não
 * numéricos, vazios ou <= 0.
 */
export const SERIE_JUROS_IMOBILIARIO = 20772
/** Série 192 = INCC (variação % mensal). */
export const SERIE_INCC = 192

async function buscarJurosImobiliarioAnual(): Promise<number> {
  const dados = await fetchSgs(SERIE_JUROS_IMOBILIARIO, 1)
  const valor = parseValorSgs(dados[0]?.valor)
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Taxa de juros imobiliária inválida')
  return valor / 100
}

/**
 * Série 192 = INCC (variação % mensal). Compõe os 12 últimos meses
 * (juros compostos) para obter o INCC acumulado em 12 meses, que é o índice
 * de reajuste anual do consórcio (RN06).
 */
async function buscarInccAnual(): Promise<number> {
  const dados = await fetchSgs(SERIE_INCC, 12)
  if (dados.length < 12) throw new Error('Série INCC incompleta')
  const acumulado = dados.reduce((acc, item) => {
    const v = parseValorSgs(item.valor)
    if (!Number.isFinite(v) || v <= -100) throw new Error('INCC inválido')
    // Acumulado composto: (1 + i1) * (1 + i2) * ... * (1 + i12)
    return acc * (1 + v / 100)
  }, 1)
  // Subtrai 1 para voltar de fator para taxa (ex.: 1,05 -> 0,05)
  return acumulado - 1
}

/**
 * Fonte de uma taxa com cache próprio, TTL e deduplicação de requisições.
 *
 *  - Cache por taxa: se só os juros vierem do BCB, o INCC continua sendo
 *    tentado nas próximas chamadas (e vice-versa).
 *  - Guarda a Promise em andamento: chamadas simultâneas compartilham a
 *    mesma requisição em vez de disparar várias.
 *  - Falhas não são cacheadas, então a próxima chamada tenta de novo.
 *  - `geracao` invalida respostas que chegam depois de um reset().
 */
function criarFonte(buscar: () => Promise<number>) {
  let cache: { valor: number; obtidoEm: number } | null = null
  let pendente: Promise<number> | null = null
  let geracao = 0

  return {
    obter(): Promise<number> {
      if (cache && Date.now() - cache.obtidoEm < TTL_MS) {
        return Promise.resolve(cache.valor)
      }
      if (pendente) return pendente

      const minhaGeracao = geracao
      pendente = buscar()
        .then((valor) => {
          if (minhaGeracao === geracao) cache = { valor, obtidoEm: Date.now() }
          return valor
        })
        .finally(() => {
          if (minhaGeracao === geracao) pendente = null
        })
      return pendente
    },
    reset() {
      geracao++
      cache = null
      pendente = null
    },
  }
}

const fonteJuros = criarFonte(buscarJurosImobiliarioAnual)
const fonteIncc = criarFonte(buscarInccAnual)

/** Registra no console quando uma taxa cai para o valor padrão (ajuda no debug). */
function registrarFalha(nome: string, resultado: PromiseSettledResult<number>): void {
  if (resultado.status === 'rejected') {
    console.warn(`[bcb] ${nome}: usando valor padrão.`, resultado.reason)
  }
}

/**
 * Taxas padrão (constantes locais), disponíveis de forma SÍNCRONA.
 * Use para renderizar a primeira tela imediatamente, sem esperar a rede (RNF02),
 * e depois atualize com o resultado de `obterTaxasAtuais()`.
 */
export function obterTaxasPadrao(): TaxasAtuais {
  return {
    jurosAnual: TAXAS_FINANCIAMENTO.jurosAnual,
    inccAnual: TAXAS_CONSORCIO.inccAnual,
    fonte: { juros: 'padrao', incc: 'padrao' },
  }
}

/**
 * Ponto de entrada do módulo. Tenta buscar os juros imobiliários e o INCC no BCB em paralelo;
 * para cada taxa que falhar, usa o valor padrão de config/taxasMercado (RNF03/RNF04).
 * Nunca lança erro: no pior caso devolve apenas os valores padrão.
 */
export async function obterTaxasAtuais(): Promise<TaxasAtuais> {
  // allSettled: a falha de uma requisição não derruba a outra
  const [jurosRes, inccRes] = await Promise.allSettled([
    fonteJuros.obter(),
    fonteIncc.obter(),
  ])

  registrarFalha('Juros', jurosRes)
  registrarFalha('INCC', inccRes)

  const padrao = obterTaxasPadrao()

  return {
    jurosAnual: jurosRes.status === 'fulfilled' ? jurosRes.value : padrao.jurosAnual,
    inccAnual: inccRes.status === 'fulfilled' ? inccRes.value : padrao.inccAnual,
    fonte: {
      juros: jurosRes.status === 'fulfilled' ? 'bcb' : 'padrao',
      incc: inccRes.status === 'fulfilled' ? 'bcb' : 'padrao',
    },
  }
}

/**
 * Limpa o cache e descarta requisições em andamento.
 * Pensada para testes (Vitest): chame em `beforeEach` para que um teste
 * não herde o cache do anterior, junto com `vi.stubGlobal('fetch', ...)`.
 */
export function resetCache(): void {
  fonteJuros.reset()
  fonteIncc.reset()
}
