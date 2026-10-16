interface Props {
  onVoltar: () => void
}

/** Premissas e glossário: explicações curtas, sem juridiquês. */
export function TelaPremissas({ onVoltar }: Props) {
  return (
    <section aria-labelledby="tp">
      <h1 id="tp">Premissas e glossário</h1>
      <p className="lead">Explicações curtas, sem juridiquês.</p>
      <div className="acc2">
        <details open>
          <summary>SAC e Price: qual a diferença?</summary>
          <p>
            No SAC você amortiza o mesmo valor todo mês; os juros caem junto com o saldo, então a parcela começa maior e
            diminui. Na Price a parcela é fixa: no começo paga-se mais juros e menos amortização.
          </p>
        </details>
        <details>
          <summary>O que são MIP, DFI e tarifa?</summary>
          <p>
            MIP é o seguro de morte e invalidez do comprador e varia com a idade. DFI é o seguro contra danos ao imóvel. A
            tarifa é um valor fixo mensal de administração do contrato.
          </p>
        </details>
        <details>
          <summary>O que é CET?</summary>
          <p>
            Custo Efetivo Total: a taxa anual que reúne juros, seguros e tarifas. É a melhor forma de comparar ofertas de
            financiamento. Como a tarifa é fixa, o CET do SAC pode sair um pouco acima do da Price mesmo quando o SAC custa
            menos em reais.
          </p>
        </details>
        <details>
          <summary>Taxa de administração, fundo de reserva e INCC no consórcio</summary>
          <p>
            A taxa de administração remunera a administradora; o fundo de reserva cobre inadimplência do grupo. O INCC é o
            índice da construção civil e reajusta o saldo e as parcelas a cada 12 meses.
          </p>
        </details>
        <details>
          <summary>Por que o limite de 30% da renda?</summary>
          <p>É a regra usada pelo mercado: a parcela não deve passar de 30% da renda mensal bruta familiar.</p>
        </details>
        <details>
          <summary>De onde vêm as taxas?</summary>
          <p>
            São médias de mercado em src/config/taxasMercado.ts (consulta em 13/10/2026). Você pode alterá-las em
            "Ajustar premissas".
          </p>
        </details>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={onVoltar}>
          Voltar à simulação
        </button>
      </div>
    </section>
  )
}
