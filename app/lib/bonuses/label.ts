/**
 * The title of a bonus, which has no name of its own: it is "Bono de 5
 * sesiones" because it holds five sessions.
 *
 * The screens take this from the `dashboard.bonuses.label` message, which
 * pluralises per language. This is the same wording for the places that write
 * Spanish on the server — the booking history, whose entries are kept in the
 * centre's language like every other line there.
 */
export function bonusLabelEs(sessions: number): string {
  return sessions === 1 ? "bono de 1 sesión" : `bono de ${sessions} sesiones`;
}
