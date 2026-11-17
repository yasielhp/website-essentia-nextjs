/** Resolves after `ms` milliseconds; the one pause the campaign senders share. */
export const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
