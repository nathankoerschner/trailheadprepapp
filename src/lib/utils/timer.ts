export function calculateRemainingTime(
  testStartedAt: string,
  durationMinutes: number,
  totalPausedMs: number = 0,
  pausedAt: string | null = null
): number {
  const startTime = new Date(testStartedAt).getTime()
  const endTime = startTime + durationMinutes * 60 * 1000
  // Add total accumulated pause time
  let pauseOffset = totalPausedMs
  // If currently paused, also add the ongoing pause duration
  if (pausedAt) {
    pauseOffset += Date.now() - new Date(pausedAt).getTime()
  }
  const remaining = Math.max(0, endTime + pauseOffset - Date.now())
  return remaining
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
