export type VisitType = 'general' | 'birthday' | 'school'

export function parseVisitType(raw: string | null | undefined): VisitType {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
  if (t === 'birthday' || t === 'party') return 'birthday'
  if (t === 'school' || t === 'schools' || t === 'trip') return 'school'
  return 'general'
}

export function visitTypeLabel(t: VisitType): string {
  if (t === 'birthday') return 'Birthday'
  if (t === 'school') return 'School trip'
  return 'General visit'
}

export function visitTypePath(t: VisitType): string {
  if (t === 'birthday') return '/birthdays'
  if (t === 'school') return '/schools'
  return '/book'
}
