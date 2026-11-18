/**
 * What closing a form dialog does: closes it, asks first, or nothing. A template
 * somebody has written is not thrown away by an Escape, the X or Cancel without
 * asking; while it is being sent nothing closes it, because the request in flight
 * would finish with nobody to tell.
 */
export function closeDecision(state: {
  dirty: boolean;
  submitting: boolean;
}): "close" | "ask" | "ignore" {
  if (state.submitting) return "ignore";
  return state.dirty ? "ask" : "close";
}
