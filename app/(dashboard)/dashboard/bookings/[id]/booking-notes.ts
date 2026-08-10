/**
 * The client's note, with the legacy therapist prefix taken off.
 *
 * Bookings taken before `staff_id` existed carry "Terapeuta: Masculino" or
 * "Terapeuta: Femenina" at the front of the notes. The service card already
 * shows that as a preference, so repeating it as prose says nothing — and a
 * booking whose note was only that prefix has no note at all.
 */
export function displayNotes(raw: string | null): string {
  return (raw ?? "")
    .replace(/^Terapeuta: Masculino\s*/, "")
    .replace(/^Terapeuta: Femenina\s*/, "")
    .trim();
}
