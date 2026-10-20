# Casa Certa — Documentação das fases

Simulador comparativo de **Financiamento × Consórcio imobiliário**, desenvolvido em grupo para a disciplina de Certificadora Específica em ADS.

> **Nota sobre esta versão.** O documento da Fase 1 é citado nos comentários do código (ex.: "Seção 3.3 do documento da Fase 1"), mas não está no repositório. Os requisitos abaixo foram reconstruídos a partir dos códigos RF/RN/RNF referenciados no código-fonte e podem estar incompletos. A divisão em fases também segue o que o repositório mostra; ajuste os nomes e datas ao que o grupo e o professor definiram.

---

## Visão geral

| Fase | Foco | Situação |
|---|---|---|
| 1 | Levantamento de requisitos e regras de negócio | Feita (documento fora do repositório) |
| 2 | Motor de cálculo (financiamento, consórcio, margem) | Concluída e testada |
| 3 | Prototipação (wireframes HTML e protótipo interativo) | Concluída — PR #3, 15/10/2026 — ver [`prototipacao/`](prototipacao/) |
| 4 | Implementação da interface e integração com o motor | Concluída — PR #4, 16/10/2026 |
| 5 | Testes finais, publicação e apresentação | A fazer |

Publicação atual: <https://casa-certa-certificadora.vercel.app> (interface do PR #4, conferida em 19/10/2026).

---

## Fase 1 — Requisitos e regras de negócio

**Objetivo:** definir o que o simulador precisa fazer e as regras de cálculo.

**Requisitos referenciados no código**

| Código | Descrição (conforme o código) |
|---|---|
| RF02 | Validação de comprometimento de renda |
| RF03 | Custo total em R$ e CET do financiamento |
| RF04 | Gráfico de custo acumulado das modalidades |
| RF05 | Usuário pode sobrescrever juros anual, idade e demais taxas |
| RN01 | A parcela não pode ultrapassar 30% da renda mensal bruta familiar |
| RN02 | SAC: amortização constante, juros sobre o saldo devedor, parcelas decrescentes |
| RN03 | Price: parcela fixa, amortização crescente e juros decrescentes |
| RN04 | Parcela do financiamento = amortização + juros + seguro MIP + seguro DFI + taxa de administração |
| RN05 | Parcela do consórcio = fundo comum + taxa de administração (inclusive antecipada) + fundo de reserva |
| RN06 | Saldo devedor e parcelas do consórcio reajustados a cada 12 meses pelo INCC |
| RN07 | Lance livre reduz o saldo devedor, reduzindo o prazo ou a parcela |
| RNF01 | Campos monetários com máscara R$ |
| RNF04 | Taxas de mercado ficam em arquivo de configuração, trocáveis sem mexer na lógica |

**Pendente de confirmação com o grupo:** RF01 e demais RNF/RN não aparecem no código.

---

## Fase 2 — Motor de cálculo

**Objetivo:** implementar a lógica como funções puras, independentes da interface, com testes automatizados.

**Entregue** (`src/calculo/` e `src/config/`)

| Arquivo | O que faz |
|---|---|
| `financiamento.ts` | Simula SAC e Price mês a mês; calcula MIP por faixa etária, DFI, tarifa, correção (TR), totais, custo total e CET anual (taxa interna de retorno por bissecção) |
| `consorcio.ts` | Simula parcelas (fundo comum, taxa de administração, fundo de reserva), taxa antecipada, reajuste INCC a cada 12 meses e lances (reduz prazo ou parcela) |
| `margem.ts` | `avaliarMargem()`: compara a parcela com 30% da renda e informa o excedente |
| `taxasMercado.ts` | Taxas padrão: juros 10,99% a.a., DFI 0,01337% a.m., tarifa R$ 25, MIP por faixa etária; consórcio com taxa de administração 16%, fundo de reserva 2%, INCC 6% a.a. |
| `*.test.ts` | Testes com Vitest (`npm test`) para os três motores |

**Decisões técnicas**
- Taxas em fração decimal (0,11 = 11%) e valores sem arredondamento interno; arredonda-se só na exibição.
- Juros mensal por equivalência composta: `(1 + anual)^(1/12) − 1`.
- A idade do comprador avança a cada 12 meses e muda a faixa do MIP.
- Para a regra dos 30%, o financiamento usa a **maior parcela** do contrato e o consórcio usa a **parcela inicial**.
- Os dados de `taxasMercado.ts` foram consultados em 13/10/2026 e precisam ser conferidos antes da entrega final.

**Histórico:** o motor do financiamento entrou pelo PR #2 (`feature/motor-financiamento`), mesclado em 15/10/2026.

---

## Fase 3 — Prototipação

**Objetivo:** validar o fluxo e o layout antes de implementar a interface.

**Entregáveis**
1. [`prototipacao/wireframes.html`](prototipacao/wireframes.html): wireframes de baixa fidelidade, navegáveis por abas (abrir direto no navegador).
2. [`prototipacao/prototipo-interativo.html`](prototipacao/prototipo-interativo.html): protótipo clicável de alta fidelidade, em arquivo único (abrir direto no navegador, sem instalar nada). Percorre as três telas, valida os campos, alterna SAC/Price/ambos, simula lance, mostra o banner dos 30%, gráficos, tabela mês a mês e exporta CSV. Funciona em desktop e celular.
   - Os cálculos são uma porta em JavaScript dos motores de `src/calculo/` e conferem com eles (SAC, Price e consórcio, com e sem lance, no cenário R$ 400 mil / entrada R$ 80 mil). A fonte da verdade continua sendo o TypeScript testado.
   - O botão "Só no protótipo" na tela de resultado força o banner verde ou laranja, para demonstrar os dois estados.

**Telas definidas**

| # | Tela | Função | Regras refletidas |
|---|---|---|---|
| 1 | Simulação | Formulário com dados do imóvel, renda, prazo, sistema (SAC/Price/ambos), premissas e lance opcionais | RF05, RN02, RN03, RN07 |
| 2 | Resultado | Banner de margem, cartões comparativos, gráfico de custo acumulado, resumo neutro | RN01, RF02, RF03 |
| 3 | Detalhamento | Tabela mês a mês e evolução do saldo, por modalidade | RN04, RN05, RN06 |
| 4 | Premissas | Glossário das taxas e regras usadas (incluída na Fase 4) | RNF04 |
| — | Mobile | Mesmas telas em coluna única | — |

**Decisões de design**
- Fluxo linear em 3 etapas com indicador de progresso.
- Opções avançadas (premissas e lance) recolhidas por padrão.
- O site não recomenda produto: apresenta números e um resumo neutro.
- Aviso fixo em todas as telas: "Simulação educativa. Não constitui oferta de crédito."
- Os valores nos wireframes são ilustrativos, não saem do motor de cálculo.

**Correspondência com o motor** (para a Fase 4)

| Campo da tela | Parâmetro no código |
|---|---|
| Valor do imóvel / Carta de crédito | `valorImovel` (financiamento) · `valorCarta` (consórcio) |
| Entrada | `entrada` |
| Prazos | `prazoMeses` |
| Sistema | `sistema: 'SAC' \| 'PRICE'` |
| Idade | `idade` |
| Juros, TR, tarifa | `jurosAnual`, `correcaoMensal`, `taxaAdministracaoMensal` |
| Taxa adm., fundo de reserva, INCC | `taxaAdministracao`, `fundoReserva`, `inccAnual` |
| Lance | `lances: { mes, valor, modo }[]` |
| Renda | `rendaMensal` em `avaliarMargem()` |

**Pontos em aberto**
- O prazo do consórcio pode ser diferente do prazo do financiamento; confirmar com o grupo se a comparação usa prazos iguais.
- A exportação de CSV é opcional.

---

## Fase 4 — Implementação da interface

**Objetivo:** construir a interface em React seguindo o protótipo, sem nenhuma regra de cálculo nas telas.

**Entregue** pelo PR #4 (`feature/interface`), mesclado em 16/10/2026:

| Arquivo | O que faz |
|---|---|
| `src/telas/TelaDados.tsx` | Formulário com máscara R$, prazos, SAC/Price/ambos, premissas e lance, validação com foco no primeiro erro |
| `src/telas/TelaResultado.tsx` | Alerta dos 30%, cartões por modalidade com custo total e CET, gráfico de custo acumulado e resumo neutro |
| `src/telas/TelaDetalhe.tsx` | Abas por modalidade, gráfico do saldo devedor, tabela mês a mês (cartões no celular) e exportação CSV |
| `src/telas/TelaPremissas.tsx` | Glossário das premissas |
| `src/ui/simulacao.ts` | Estado do formulário, validação e chamada aos motores de `src/calculo` |
| `src/ui/` (demais) | `CampoMoeda`, `Segmentado`, `GraficoLinha` (react-chartjs-2) e formatação pt-BR com testes |

**Arquitetura:** telas → `src/ui/simulacao.ts` → motores em `src/calculo/` → taxas em `src/config/taxasMercado.ts`. Não há banco de dados: tudo roda no navegador e os dados ficam só na memória da página.

**Situação em 19/10/2026:** `npm test` com 63 testes passando; lint e build limpos. O template do Vite foi removido.

## Fase 5 — Testes finais e entrega (a fazer)

- Conferir as taxas de mercado e as fontes citadas em `taxasMercado.ts`.
- Teste manual do fluxo completo, em desktop e celular.
- Publicação na Vercel e apresentação.
