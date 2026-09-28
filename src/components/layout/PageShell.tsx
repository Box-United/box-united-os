import type { ReactNode } from 'react'

// Full-width page body: fluid up to 1400px, centered, consistent padding.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-auto" style={{ background: '#EEF2F7' }}>
      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8">{children}</div>
    </div>
  )
}

interface HeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, icon, actions }: HeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Archivo, sans-serif' }}>{title}</h1>
        </div>
        {subtitle && <p className={`text-sm text-gray-400 mt-0.5 ${icon ? 'ml-7' : ''}`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">{children}</h2>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  )
}

export function ProgressBar({ pct, tone = 'blue' }: { pct: number; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const color = { blue: '#2563EB', green: '#16a34a', amber: '#d97706', red: '#dc2626' }[tone]
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}
