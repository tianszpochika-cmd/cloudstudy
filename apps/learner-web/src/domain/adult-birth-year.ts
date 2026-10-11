/** Client only checks that the year is an integer in 1900…the current year. Age is decided by IAM. */
export function isSubmittableBirthYear(year: unknown, currentYear = new Date().getFullYear()): boolean {
  return typeof year === 'number' && Number.isInteger(year) && year >= 1900 && year <= currentYear
}

export function currentBirthYearMax(now = new Date()): number {
  return now.getFullYear()
}
