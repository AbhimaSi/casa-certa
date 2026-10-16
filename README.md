# Casa Certa

Simulador educativo que compara, com as mesmas premissas, **financiamento imobiliário (SAC e Price)** e **consórcio** para um mesmo imóvel: evolução das parcelas, custo total, CET e alerta de comprometimento de renda (30%).

Aplicação de página única, 100% no navegador: nenhum dado sai da máquina do usuário e, depois de carregada, funciona offline.

## Como rodar

```bash
npm install
npm run dev      # servidor local (Vite)
npm test         # testes dos motores de cálculo e da formatação (Vitest)
npm run lint     # oxlint
npm run build    # produção em dist/
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/calculo/` | Motores de cálculo: `financiamento.ts` (SAC, Price, MIP/DFI, CET), `consorcio.ts` (fundo comum, taxas, INCC, lances), `margem.ts` (regra dos 30%). Funções puras, com testes. |
| `src/config/taxasMercado.ts` | Taxas médias de mercado, com fonte e data. Trocar um valor aqui não exige mexer nos cálculos. |
| `src/ui/` | Estado da simulação (`simulacao.ts`, que liga o formulário aos motores), formatação pt-BR e componentes (campo monetário, botões segmentados, gráfico). |
| `src/telas/` | As telas: Dados, Resultado, Detalhamento e Premissas. |
| `docs/` | Documentação das fases e protótipos (wireframes e protótipo interativo). |

## Equipe

| Integrante | Responsabilidade |
|---|---|
| Davi | Motor de cálculo de financiamento |
| João | Motor de cálculo de consórcio |
| Matheus | Interface e gráficos |
| Gabriel | Prototipação e documentação das fases |
| Abhimael | Repositório, integração, testes e vídeo |

Stack: React 19 + TypeScript + Vite, Chart.js (react-chartjs-2), Vitest. Deploy estático na Vercel.

> Simulação educativa. Não constitui oferta de crédito nem substitui consultoria financeira.
