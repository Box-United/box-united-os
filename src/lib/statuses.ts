import type { ProgressStatus } from '../types/database'

// The one status list for goals, rocks and KPIs (migration 016)
export const PROGRESS_OPTIONS: ProgressStatus[] = ['not-started', 'on-track', 'off-track', 'done']
