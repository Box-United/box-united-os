// End-of-week status questions.
// TODO(MK): replace these with the exact questions from the current EOW Google Form,
// in the same order. Keep each `id` stable once people start submitting — answers
// are stored by id.
export interface EowQuestion {
  id: string
  label: string
  help?: string
  required?: boolean
}

export const EOW_QUESTIONS: EowQuestion[] = [
  { id: 'done', label: 'What did you get done this week?', required: true },
  { id: 'blockers', label: 'Any blockers, or anything you need from the team?' },
  { id: 'next_week', label: "What's your focus for next week?", required: true },
]
