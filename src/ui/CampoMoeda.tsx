import { useLayoutEffect, useRef, useState } from 'react'
import { lerNumero, num2 } from './formatos'

interface Props {
  id: string
  valor: number
  onChange: (v: number) => void
  placeholder?: string
  invalido?: boolean
}

/**
 * Campo monetário com máscara automática (RNF01): enquanto edita, mostra o texto digitado;
 * ao sair, formata em "1.234,56". O valor numérico sobe para o pai a cada tecla.
 */
export function CampoMoeda({ id, valor, onChange, placeholder, invalido }: Props) {
  const [foco, setFoco] = useState(false)
  const [texto, setTexto] = useState('')
  const exibido = foco ? texto : Number.isNaN(valor) ? '' : num2(valor)
  const campo = useRef<HTMLInputElement>(null)

  // Ao ganhar foco o texto muda de "1.234,56" para "1234,56" e o navegador perde a seleção.
  // Selecionar tudo logo após essa troca faz o que for digitado substituir o valor
  // (ex.: ao chegar no campo com Tab), em vez de ser colado no fim do número antigo.
  useLayoutEffect(() => {
    if (foco) campo.current?.select()
  }, [foco])

  return (
    <div className="moeda">
      <span aria-hidden="true">R$</span>
      <input
        ref={campo}
        id={id}
        inputMode="decimal"
        className={invalido ? 'bad' : undefined}
        aria-invalid={invalido || undefined}
        placeholder={placeholder}
        value={exibido}
        onFocus={() => {
          setTexto(Number.isNaN(valor) ? '' : String(valor).replace('.', ','))
          setFoco(true)
        }}
        onChange={(e) => {
          setTexto(e.target.value)
          onChange(lerNumero(e.target.value))
        }}
        onBlur={() => setFoco(false)}
      />
    </div>
  )
}
