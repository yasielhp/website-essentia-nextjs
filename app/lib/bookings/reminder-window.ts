/**
 * How far ahead a session is when its reminder goes out: roughly two days.
 *
 * Two days is deliberate: the free-cancellation window closes 24 hours before,
 * so the reminder has to land while cancelling is still free. A slot freed two
 * days out can be sold again; a no-show cannot. The email reminder and the
 * WhatsApp reminder share the window, so both read it from here.
 */
export const REMINDER_WINDOW_START_HOURS = 40;
export const REMINDER_WINDOW_END_HOURS = 56;
