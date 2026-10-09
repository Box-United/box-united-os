// Goals, rocks and KPIs share one status list (migration 016)
export type ProgressStatus = 'not-started' | 'on-track' | 'off-track' | 'done'
export type RockStatus = ProgressStatus
export type GoalStatus = ProgressStatus
export type KpiStatus = ProgressStatus
export type TeamTaskStatus = 'todo' | 'in-progress' | 'done'
export type Department = 'program' | 'development' | 'operations' | 'marketing' | 'finance' | 'accounting'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  preferred_name?: string | null  // what they go by, e.g. "Mary Kate" (migration 017)
  avatar_url: string | null
  role: string | null
  manager_id: string | null
  title: string | null
  departments: Department[] | null
  created_at: string
}

export interface Rock {
  id: string
  user_id: string
  title: string
  description: string | null
  status: RockStatus
  quarter: string
  due_date: string | null
  team_goal_id?: string | null  // the goal it supports (migration 014)
  goal_id?: string | null
  created_at: string
}

export interface TeamTask {
  id: string
  created_by: string
  assigned_to: string | null
  title: string
  description: string | null
  status: TeamTaskStatus
  due_date: string | null
  kpi_id: string | null
  rock_id: string | null
  goal_id?: string | null       // a personal annual goal (migration 013)
  team_goal_id?: string | null  // a team annual goal (migration 013)
  on_team_board?: boolean       // false for tasks that are only on the owner's dashboard
  recurring_id?: string | null  // the repeating schedule that made it (migration 016)
  assigned_in_meeting: boolean
  source: 'manual' | 'monday'
  monday_item_id: string | null
  completed_at: string | null
  archived_month: string | null
  needs_discussion: boolean
  created_at: string
}

export interface AnnualGoal {
  id: string
  title: string
  description: string | null
  status: GoalStatus
  year: number
  owner_id: string | null
  department: Department | null
  metric_key?: string | null  // the key metric this team goal moves (migration 014)
  created_by: string
  created_at: string
  owner?: Profile | null
  creator?: Profile
}

// Built-in keys are 'schools', 'dollars_raised' and 'students'; added metrics get generated keys
export type MetricKey = string
export type MetricUnit = 'number' | 'currency' | 'percent'

export interface KeyMetric {
  key: MetricKey
  label: string
  department: Department
  unit: MetricUnit
  sort_order: number
  created_by: string | null
  created_at: string
}

export interface ScorecardMetric {
  id: string
  year: number
  metric_key: MetricKey
  target: number | null
  actual: number | null
  updated_by: string | null
  updated_at: string
}

export interface MetricHistory {
  id: string
  year: number
  metric_key: MetricKey
  actual: number | null
  target: number | null
  edited_by: string | null
  edited_at: string
}

export interface KpiArea {
  id: string
  user_id: string
  name: string
  monday_url: string | null
  department: Department | null
  sort_order: number
  created_at: string
}

export interface Kpi {
  id: string
  area_id: string
  user_id: string
  title: string
  target: number | null
  current: number | null
  status: KpiStatus
  sort_order: number
  team_goal_id?: string | null  // what it supports: a goal or a rock (migration 014)
  goal_id?: string | null
  rock_id?: string | null
  year: number                  // the year it counts toward (migration 016)
  quarter: number | null        // 1–4 for a quarterly KPI; empty = annual
  copied_from?: string | null   // last period's KPI it was copied from
  updated_by: string | null
  updated_at: string
  created_at: string
}

// A repeating schedule that makes its own tasks (migration 016)
export interface RecurringTask {
  id: string
  title: string
  description: string | null
  assigned_to: string
  created_by: string
  kpi_id: string | null
  rock_id: string | null
  goal_id: string | null
  team_goal_id: string | null
  on_team_board: boolean
  frequency: 'weekly' | 'monthly'
  every_weeks: number
  weekdays: number[]            // 1 = Monday … 7 = Sunday
  month_week: number | null     // monthly: 1–4, or -1 for the last one
  starts_on: string
  ends_on: string | null
  max_count: number | null
  made_count: number
  last_date: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  actor_id: string | null
  task_id: string | null
  kind: string
  message: string
  read_at: string | null
  created_at: string
}

export interface EowSubmission {
  id: string
  user_id: string
  week_of: string
  answers: Record<string, string>
  submitted_at: string
  updated_at: string
}

export interface MondayConnection {
  user_id: string
  board_id: string
  board_name: string | null
  board_url: string | null
  column_map: Record<string, string>
  webhook_ids: string[]
  from_template: boolean
  last_synced_at?: string | null
  created_at: string
}

export interface IndividualGoal {
  id: string
  user_id: string
  year: number
  title: string
  status: KpiStatus
  sort_order: number
  created_at: string
}

export type ReviewPeriod = 'mid_year' | 'end_of_year'

export interface PerformanceReview {
  id: string
  employee_id: string
  year: number
  period: ReviewPeriod
  reviewer_id: string | null
  self_submitted_at: string | null
  shared_at: string | null
  employee_signed_at: string | null
  reviewer_signed_at: string | null
  snapshot: ReviewItem[] | null
  created_at: string
}

// One goal / KPI / rock being reviewed; `key` is "<kind>:<id>"
export interface ReviewItem {
  key: string
  kind: 'goal' | 'kpi' | 'rock'
  title: string
  status: string
  detail?: string
}

export interface ReviewPart {
  review_id: string
  answers: Record<string, string>
  items: Record<string, string>
  updated_at: string
}
