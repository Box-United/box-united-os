// What a rock or KPI supports, encoded for <select> values as "team_goal:<id>",
// "goal:<id>" or "rock:<id>" ('' = nothing). Rocks support goals; KPIs support
// goals or rocks.
export interface ParentFields {
  team_goal_id?: string | null
  goal_id?: string | null
  rock_id?: string | null
}

export function parentValue(x: ParentFields) {
  return x.team_goal_id ? `team_goal:${x.team_goal_id}` : x.goal_id ? `goal:${x.goal_id}` : x.rock_id ? `rock:${x.rock_id}` : ''
}

// Fields to save for a choice; `withRock` is false for rocks (they can't sit under a rock)
export function parentPatch(value: string, withRock: boolean): ParentFields {
  const [kind, id] = value.split(':')
  const patch: ParentFields = {
    team_goal_id: kind === 'team_goal' ? id : null,
    goal_id: kind === 'goal' ? id : null,
  }
  if (withRock) patch.rock_id = kind === 'rock' ? id : null
  return patch
}
