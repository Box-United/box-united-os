// End-of-week status questions, matching the "Weekly Check In" Google Form
// (reflection form to inform leadership 1:1s). The form's "Today" date field is
// covered by the submission timestamp. Keep each `id` stable once people start
// submitting — answers are stored by id.
export interface EowQuestion {
  id: string
  label: string
  help?: string
  required?: boolean
  showRocks?: boolean
}

export const EOW_FORM_TITLE = 'Weekly Check In'
export const EOW_FORM_DESCRIPTION = 'Reflection form to inform leadership 1:1s'

export const EOW_QUESTIONS: EowQuestion[] = [
  { id: 'wins', label: 'Wins this week', required: true },
  { id: 'quarterly_goals', label: 'Quarterly Rocks: on track or off track?', required: true, showRocks: true },
  { id: 'stuck', label: 'What’s stuck, and where do you need Mary Kate?', required: true },
  { id: 'top_three', label: 'Your top three priorities for next week', required: true },
  { id: 'discuss', label: 'What, if anything, do you need to discuss with the team this week?' },
  { id: 'missed', label: 'What did you not get to this week that mattered?' },
]
