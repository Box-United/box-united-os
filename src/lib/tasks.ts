import type { RecurringTask, TeamTask } from '../types/database'
import { monthKey, shortDate } from './team'

// The month a finished task is filed under: when it was done (or, for tasks
// archived by hand before filing was automatic, the month it was archived to)
export function doneMonth(t: TeamTask) {
  if (t.archived_month) return t.archived_month
  return monthKey(new Date(t.completed_at ?? t.created_at))
}

// Finished this month, or still open: what the current views show
export function isCurrent(t: TeamTask) {
  return t.status !== 'done' || doneMonth(t) >= monthKey()
}

// Months that have finished tasks filed under them, newest first (not this month)
export function pastMonths(tasks: TeamTask[]) {
  const now = monthKey()
  return [...new Set(tasks.filter(t => t.status === 'done').map(doneMonth).filter(m => m < now))].sort().reverse()
}

// 1 = Monday … 7 = Sunday, like the database
export const WEEKDAYS = [
  { n: 1, short: 'Mon', letter: 'M' },
  { n: 2, short: 'Tue', letter: 'T' },
  { n: 3, short: 'Wed', letter: 'W' },
  { n: 4, short: 'Thu', letter: 'T' },
  { n: 5, short: 'Fri', letter: 'F' },
  { n: 6, short: 'Sat', letter: 'S' },
  { n: 7, short: 'Sun', letter: 'S' },
]
export const MONTH_WEEKS = [
  { n: 1, label: 'first' },
  { n: 2, label: 'second' },
  { n: 3, label: 'third' },
  { n: 4, label: 'fourth' },
  { n: -1, label: 'last' },
]

// Weekday of a YYYY-MM-DD date, 1 = Monday
export function isoWeekday(date: string) {
  return ((new Date(date + 'T00:00').getDay() + 6) % 7) + 1
}

// Which of that weekday in its month a date is: 1–4, or -1 when it's the last
export function weekOfMonth(date: string) {
  const d = new Date(date + 'T00:00')
  const later = new Date(d)
  later.setDate(d.getDate() + 7)
  if (later.getMonth() !== d.getMonth()) return -1
  return Math.min(4, Math.floor((d.getDate() - 1) / 7) + 1)
}

// "Every Fri", "Every 2 weeks on Mon, Wed", "Last Fri of the month · until Dec 31"
export function describeSchedule(r: Pick<RecurringTask, 'frequency' | 'every_weeks' | 'weekdays' | 'month_week' | 'ends_on' | 'max_count'>) {
  const days = WEEKDAYS.filter(w => r.weekdays.includes(w.n)).map(w => w.short).join(', ')
  const when = r.frequency === 'monthly'
    ? `${MONTH_WEEKS.find(m => m.n === r.month_week)?.label ?? ''} ${days} of the month`.replace(/^./, c => c.toUpperCase())
    : r.every_weeks > 1 ? `Every ${r.every_weeks} weeks on ${days}` : `Every ${days}`
  const ends = r.ends_on ? ` · until ${shortDate(r.ends_on)}` : r.max_count ? ` · ${r.max_count} times` : ''
  return when + ends
}
