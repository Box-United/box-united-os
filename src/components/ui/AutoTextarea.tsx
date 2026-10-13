import { useEffect, useRef } from 'react'

interface Props {
  id: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  rows?: number
  className?: string            // replaces the default box styling
}

// Long-answer box that grows with its content.
export function AutoTextarea({ id, value, onChange, onBlur, disabled, autoFocus, placeholder = 'Long answer…', rows = 4, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      id={id}
      ref={ref}
      rows={rows}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full resize-none ${className ?? 'text-sm text-gray-800 leading-relaxed border border-gray-200 rounded-xl px-3.5 py-3 outline-none focus:border-blue-400 bg-white disabled:bg-gray-50'}`}
      style={{ minHeight: rows * 26 }}
    />
  )
}
