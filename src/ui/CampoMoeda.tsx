import { useState } from 'react'
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

  return (
    <div className="moeda">
      <span aria-hidden="true">R$</span>
      <input
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
