export interface TimeSlot {
  time: string
  available: boolean
}

const BASE_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30',
]

function hashSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function format12h(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(minute).padStart(2, '0')} ${period}`
}

export function getTimeSlots(date: string): TimeSlot[] {
  const seed = hashSeed(date + 'sawaba')
  const unavailable = new Set<number>()
  for (let i = 0; i < 5; i += 1) {
    unavailable.add((seed + i * 7) % BASE_SLOTS.length)
  }
  return BASE_SLOTS.map((time, index) => ({
    time: format12h(time),
    available: !unavailable.has(index),
  }))
}

export function isDateInPast(date: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${date}T00:00:00`)
  return target.getTime() < today.getTime()
}

export function buildCalendarDays(monthOffset = 0): string[] {
  const today = new Date()
  const days: string[] = []
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() + monthOffset,
      today.getDate() + i,
    )
    days.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    )
  }
  return days
}