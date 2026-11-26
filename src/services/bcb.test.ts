import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAXAS_CONSORCIO, TAXAS_FINANCIAMENTO } from '../config/taxasMercado'
import { SERIE_INCC, SERIE_JUROS_IMOBILIARIO, obterTaxasAtuais, obterTaxasPadrao, resetCache } from './bcb'

/** Resposta da API SGS: lista de { data, valor } com o valor em texto. */
const resposta = (valores: string[]) =>
  new Response(JSON.stringify(valores.map((valor, i) => ({ data: `01/${String(i + 1).padStart(2, '0')}/2026`, valor }))), {
    status: 200,
  })

const serieDaUrl = (url: string) => Number(/bcdata\.sgs\.(\d+)/.exec(url)?.[1])

/** fetch falso: responde cada série com a função dada. */
function simularApi(porSerie: Record<number, () => Response | Promise<Response>>) {
  const fetchFalso = vi.fn((url: string) => {
    const responder = porSerie[serieDaUrl(url)]
    return responder ? Promise.resolve(responder()) : Promise.reject(new Error('série inesperada'))
  })
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

const DOZE_MESES_DE_0_5 = Array(12).fill('0.5')

beforeEach(() => {
  resetCache()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('obterTaxasPadrao (RNF02/RNF04)', () => {
  it('devolve as taxas de config/taxasMercado, de forma síncrona', () => {
    expect(obterTaxasPadrao()).toEqual({
      jurosAnual: TAXAS_FINANCIAMENTO.jurosAnual,
      inccAnual: TAXAS_CONSORCIO.inccAnual,
      fonte: { juros: 'padrao', incc: 'padrao' },
    })
  })
})

describe('obterTaxasAtuais', () => {
  it('usa a série do financiamento imobiliário (20772), não a Selic (432)', async () => {
    const fetchFalso = simularApi({
      [SERIE_JUROS_IMOBILIARIO]: () => resposta(['11.5']),
      [SERIE_INCC]: () => resposta(DOZE_MESES_DE_0_5),
    })
    await obterTaxasAtuais()
    const series = fetchFalso.mock.calls.map(([url]) => serieDaUrl(url))
    expect(SERIE_JUROS_IMOBILIARIO).toBe(20772)
    expect(series).toContain(20772)
    expect(series).not.toContain(432)
  })

  it('converte os juros de % a.a. para decimal e compõe o INCC de 12 meses', async () => {
    simularApi({
      [SERIE_JUROS_IMOBILIARIO]: () => resposta(['11.5']),
      [SERIE_INCC]: () => resposta(DOZE_MESES_DE_0_5),
    })
    const taxas = await obterTaxasAtuais()
    expect(taxas.jurosAnual).toBeCloseTo(0.115, 10)
    // 0,5% ao mês por 12 meses, composto: 1,005^12 − 1 ≈ 6,17%
    expect(taxas.inccAnual).toBeCloseTo(Math.pow(1.005, 12) - 1, 10)
    expect(taxas.fonte).toEqual({ juros: 'bcb', incc: 'bcb' })
  })

  it('cai para as taxas padrão sem lançar erro quando a API está fora (RNF03)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(obterTaxasAtuais()).resolves.toEqual(obterTaxasPadrao())
  })

  it('aproveita a taxa que veio e usa o padrão só na que falhou', async () => {
    simularApi({
      [SERIE_JUROS_IMOBILIARIO]: () => new Response('erro', { status: 500 }),
      [SERIE_INCC]: () => resposta(DOZE_MESES_DE_0_5),
    })
    const taxas = await obterTaxasAtuais()
    expect(taxas.jurosAnual).toBe(TAXAS_FINANCIAMENTO.jurosAnual)
    expect(taxas.fonte).toEqual({ juros: 'padrao', incc: 'bcb' })
  })

  it('rejeita valores inválidos e série do INCC incompleta', async () => {
    simularApi({
      [SERIE_JUROS_IMOBILIARIO]: () => resposta(['']),
      [SERIE_INCC]: () => resposta(['0.5', '0.4']),
    })
    await expect(obterTaxasAtuais()).resolves.toEqual(obterTaxasPadrao())
  })

  it('desiste após 5 s sem resposta e usa o padrão (RNF02)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, rejeitar) =>
            init?.signal?.addEventListener('abort', () => rejeitar(new DOMException('abortado', 'AbortError'))),
          ),
      ),
    )
    const promessa = obterTaxasAtuais()
    await vi.advanceTimersByTimeAsync(5000)
    await expect(promessa).resolves.toEqual(obterTaxasPadrao())
  })

  it('guarda em cache por 24 h e não repete a requisição', async () => {
    const fetchFalso = simularApi({
      [SERIE_JUROS_IMOBILIARIO]: () => resposta(['11.5']),
      [SERIE_INCC]: () => resposta(DOZE_MESES_DE_0_5),
    })
    await obterTaxasAtuais()
    await obterTaxasAtuais()
    expect(fetchFalso).toHaveBeenCalledTimes(2) // uma chamada por série, só na primeira vez
  })

  it('não guarda falhas em cache: tenta de novo na próxima chamada', async () => {
    let tentativas = 0
    simularApi({
      [SERIE_JUROS_IMOBILIARIO]: () => (++tentativas === 1 ? new Response('erro', { status: 503 }) : resposta(['11.5'])),
      [SERIE_INCC]: () => resposta(DOZE_MESES_DE_0_5),
    })
    expect((await obterTaxasAtuais()).fonte.juros).toBe('padrao')
    expect((await obterTaxasAtuais()).fonte.juros).toBe('bcb')
  })
})
