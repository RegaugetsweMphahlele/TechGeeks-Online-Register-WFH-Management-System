import { useEffect, useState } from 'react'

/** Re-render every `ms` with the current time (display only — the server stamps every action). */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** Reload when the tab regains focus and every `ms`, so changes from another device or a correction show up. */
export function useRefresh(reload, ms = 120000) {
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onFocus)
    const id = setInterval(onFocus, ms)
    return () => { document.removeEventListener('visibilitychange', onFocus); clearInterval(id) }
  }, [reload, ms])
}
