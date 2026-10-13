import { formatBRL } from '../lib/format'

interface Props {
  /** Centavos. */
  value: number
  onChange: (cents: number) => void
  autoFocus?: boolean
  className?: string
  id?: string
}

/** Campo de valor em R$: os dígitos entram pela direita, como em maquininha de cartão. */
export function MoneyInput({ value, onChange, autoFocus, className = 'field', id }: Props) {
  return (
    <input
      id={id}
      className={className}
      inputMode="numeric"
      autoFocus={autoFocus}
      value={formatBRL(value)}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 11)))}
    />
  )
}
