/**
 * Booking party rules for Little Scientist.
 *
 * The park is for children. Realistic party mixes:
 * - Adults alone → blocked
 * - Children / free infants alone → blocked (need a supervising adult)
 * - Adult(s) + paid child(ren) → ok
 * - Adult(s) + free infant(s) only → ok
 * - Adult(s) + mix of children and infants → ok
 */

export type PartyCounts = {
  adults: number
  children: number // paid: 95cm – 17 years
  infants: number // free: 94.9cm and below
}

export type PartyIssueCode = 'EMPTY' | 'ADULTS_ONLY' | 'MINORS_ONLY' | 'NO_PAID_VISITOR' | 'INVALID'

export type PartyValidation =
  | { ok: true }
  | {
      ok: false
      code: PartyIssueCode
      title: string
      message: string
      actionLabel: string
      focus: 'adult' | 'child' | 'any'
    }

function n(v: unknown) {
  const x = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(x) || x < 0) return 0
  return Math.floor(x)
}

export function normalizeParty(p: PartyCounts): Required<PartyCounts> {
  return {
    adults: n(p.adults),
    children: n(p.children),
    infants: n(p.infants),
  }
}

export function minorCount(p: PartyCounts) {
  const { children, infants } = normalizeParty(p)
  return children + infants
}

export function partyHeadcount(p: PartyCounts) {
  const { adults, children, infants } = normalizeParty(p)
  return adults + children + infants
}

/**
 * Structural party rules (who may visit together).
 * Does not check pricing — use needsPaidVisitor separately at checkout.
 */
export function validateBookingParty(raw: PartyCounts): PartyValidation {
  const p = normalizeParty(raw)
  const minors = p.children + p.infants

  if (p.adults === 0 && minors === 0) {
    return {
      ok: false,
      code: 'EMPTY',
      title: "Who's coming?",
      message: 'Add at least one adult and one child (or free infant) to book a visit.',
      actionLabel: 'Add visitors',
      focus: 'any',
    }
  }

  // Adults without any child / infant — park is for little scientists
  if (p.adults > 0 && minors === 0) {
    const title = p.adults === 1 ? 'Bring a little scientist' : 'Adults need little scientists'
    const message =
      p.adults === 1
        ? 'An adult ticket can’t be booked alone. Add at least one child (95cm–17 years) or a free infant (94.9cm and below).'
        : 'Adult-only groups aren’t allowed. Add at least one child or free infant so there’s a little scientist in the party.'
    return {
      ok: false,
      code: 'ADULTS_ONLY',
      title: `${title} 🔬`,
      message,
      actionLabel: 'Add a child',
      focus: 'child',
    }
  }

  // Children / infants without a supervising adult
  if (p.adults === 0 && minors > 0) {
    const onlyInfants = p.children === 0 && p.infants > 0
    const onlyPaid = p.infants === 0 && p.children > 0
    let message =
      'Every child must be accompanied and supervised by a responsible adult. Please add at least one adult to continue.'
    if (onlyInfants) {
      message =
        'Free infant entry still needs a supervising adult at the gate. Please add at least one adult ticket.'
    } else if (onlyPaid) {
      message =
        'Children can’t visit without an adult. Please add at least one adult ticket to continue.'
    } else {
      message =
        'Children and free infants must visit with a supervising adult. Please add at least one adult ticket.'
    }
    return {
      ok: false,
      code: 'MINORS_ONLY',
      title: 'Adults required 👋🏾',
      message,
      actionLabel: 'Add an adult',
      focus: 'adult',
    }
  }

  return { ok: true }
}

/** Checkout needs at least one paid ticket (adult or paid child). Free infants alone never pay. */
export function validatePaidCheckout(raw: PartyCounts, totalKes: number): PartyValidation {
  const party = validateBookingParty(raw)
  if (!party.ok) return party

  if (!(Number(totalKes) > 0)) {
    return {
      ok: false,
      code: 'NO_PAID_VISITOR',
      title: 'Add a paid ticket',
      message:
        'Free infant entry doesn’t create a payable booking on its own. Add at least one adult or paid child ticket.',
      actionLabel: 'Update tickets',
      focus: 'any',
    }
  }

  return { ok: true }
}
