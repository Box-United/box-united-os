import { useRef, useState } from 'react'

// A name you can click to change. Enter or clicking away saves, Escape cancels,
// and an empty box keeps the old name.
export function EditableText({ value, editable, onSave, label, className = '' }: {
  value: string
  editable: boolean
  onSave: (next: string) => void
  label: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // Enter closes the box, which also blurs it; save only once
  const closed = useRef(false)

  function open() {
    closed.current = false
    setDraft(value)
    setEditing(true)
  }

  function close(save: boolean) {
    if (closed.current) return
    closed.current = true
    const next = draft.trim()
    if (save && next && next !== value) onSave(next)
    setEditing(false)
  }

  if (!editable) return <span className={className}>{value}</span>
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => close(true)}
        onKeyDown={e => { if (e.key === 'Enter') close(true); if (e.key === 'Escape') close(false) }}
        aria-label={label}
        className={`${className} w-full min-w-[12rem] bg-transparent border-b border-blue-500 outline-none`} />
    )
  }
  return (
    <button type="button" onClick={open} title="Click to rename" className={`${className} text-left cursor-text hover:text-blue-600`}>
      {value}
    </button>
  )
}
