interface Opcao<T extends string> {
  valor: T
  rotulo: string
}

interface Props<T extends string> {
  opcoes: Opcao<T>[]
  valor: T
  onChange: (v: T) => void
  'aria-labelledby'?: string
  className?: string
}

/** Grupo de botões excludentes (SAC / Price / ambos, reduz prazo / reduz parcela, abas). */
export function Segmentado<T extends string>({ opcoes, valor, onChange, className, ...aria }: Props<T>) {
  return (
    <div className={'seg' + (className ? ' ' + className : '')} role="group" {...aria}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => onChange(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
