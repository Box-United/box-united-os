// 'in-progress' stays for task statuses and reviews signed before migration 016
export const STATUS_LABELS: Record<string, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  'on-track': 'On track',
  'off-track': 'Off track',
  done: 'Done',
}

// Class names map to .status-pill variants in index.css
function pillClass(status: string) {
  return status === 'done' ? 'goal-done' : status
}

interface Props {
  status: string
  options?: string[]
  onChange?: (status: string) => void
  small?: boolean
}

export function StatusPill({ status, options, onChange, small }: Props) {
  const cls = `status-pill ${pillClass(status)}${small ? ' text-[11px]' : ''}`
  if (!onChange || !options) {
    return <span className={cls}>{STATUS_LABELS[status] ?? status}</span>
  }
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value)}
      className={`${cls} cursor-pointer outline-none border-none appearance-none`}
      aria-label="Status"
    >
      {options.map(s => (
        <option key={s} value={s} className="text-gray-800 bg-white">
          {STATUS_LABELS[s] ?? s}
        </option>
      ))}
    </select>
  )
}
