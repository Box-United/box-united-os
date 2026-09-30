// Monday.com section shown on the Team Board.
// Placeholder until Alexandra decides which part of Monday.com the team should see here
// (a board, a group within a board, or a dashboard). When decided, fill these in:
//   title    — heading shown on the Team Board, e.g. "Programs pipeline"
//   url      — link to that board / group / dashboard in Monday.com
//   owner    — who chose it and maintains it
export interface MondayTeamSection {
  title: string | null
  description: string | null
  url: string | null
  owner: string
}

export const MONDAY_TEAM_SECTION: MondayTeamSection = {
  title: null,
  description: null,
  url: null,
  owner: 'Alexandra Foster',
}
