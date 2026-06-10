// Tiny pub/sub so the operator console (and anything else) can append
// entries to the dashboard event stream without prop drilling.

export interface FeedEntry {
  text: string
  tone: "accent" | "amber" | "muted" | "error"
  source: "stem-ci" | "ERROR"
}

type Listener = (entry: FeedEntry) => void

const listeners = new Set<Listener>()

export function subscribeFeed(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function pushFeed(entry: FeedEntry): void {
  for (const fn of listeners) fn(entry)
}
