import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Relative time from an ISO string — "28s ago", "42m ago", "3h ago". */
export function timeAgo(isoString?: string | null): string {
  if (!isoString) return "just now"
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (!Number.isFinite(seconds) || seconds < 0) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/** "15:28:07" — UTC wall clock for a given moment. */
export function utcTime(date: Date = new Date()): string {
  return date.toISOString().slice(11, 19)
}

/** "15:28:07 UTC" */
export function utcClock(date: Date = new Date()): string {
  return `${utcTime(date)} UTC`
}
