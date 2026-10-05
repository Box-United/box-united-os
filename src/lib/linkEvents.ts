import { useEffect, useState } from 'react'
import { requestMondaySync } from './mondaySync'

const EVENT = 'bu:goal-data-changed'

// Call after any rock, KPI or goal is added, changed or deleted: refreshes every
// section on the page that shows how they link up, and the shared Monday board.
export function goalDataChanged() {
  window.dispatchEvent(new Event(EVENT))
  requestMondaySync()
}

// Bumps whenever goalDataChanged() fires; add it to an effect's deps to refetch
export function useGoalDataVersion() {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion(v => v + 1)
    window.addEventListener(EVENT, bump)
    return () => window.removeEventListener(EVENT, bump)
  }, [])
  return version
}
