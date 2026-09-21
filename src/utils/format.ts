export function formatPrice(price: number): string {
  return `\u20A6${price.toLocaleString('en-NG')}`
}

export function formatDuration(minutes: number): string {
  return `${minutes} min`
}

export function formatDate(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return date
  return value.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Convert HH:mm (24h) → h:mm AM/PM */
export function formatTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!match) return time
  const hours = Number(match[1])
  const minutes = match[2]
  const period = hours >= 12 ? 'PM' : 'AM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${minutes} ${period}`
}
