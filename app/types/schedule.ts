/**
 * When somebody works: one entry per weekday, JavaScript numbering
 * (0 = Sunday), so a date can be looked up without translating conventions.
 *
 * This lives on the person, not on the treatment. A session type has no
 * working days; the therapist who performs it does.
 */
export type WeeklySchedule = Record<
  string,
  { open: boolean; start: string; end: string }
>;
