export function isRecent(timestamp, now, threshold) {
  const age = now - Date.parse(timestamp)
  return Number.isFinite(age) && age >= 0 && age <= threshold * 1000
}
