/**
 * What the page does with the answer of a reset, over plain values: which notice
 * to show when it worked, or the failure to show INSIDE the dialog (which stays
 * open, with its button ready to try again). Pure apart from the call it is
 * given, so the page and the tests run the same thing.
 */

export type ResetAnswer =
  | { ok: true; removed: boolean; kept: "disabled" | null }
  | { ok: false; error: string; detail?: string };

export type ResetNotice =
  "whatsappRemoved" | "keptDisabled" | "done" | "nothing";

export type ResetOutcome =
  | { status: "done"; notice: ResetNotice }
  | { status: "failed"; failure: { error: string; detail?: string } };

export async function runReset(
  channel: "email" | "whatsapp",
  call: () => Promise<ResetAnswer>,
): Promise<ResetOutcome> {
  let answer: ResetAnswer;
  try {
    answer = await call();
  } catch {
    return { status: "failed", failure: { error: "generic" } };
  }
  if (!answer.ok) {
    return {
      status: "failed",
      failure:
        answer.detail === undefined
          ? { error: answer.error }
          : { error: answer.error, detail: answer.detail },
    };
  }
  if (channel === "whatsapp")
    return { status: "done", notice: "whatsappRemoved" };
  if (answer.kept === "disabled")
    return { status: "done", notice: "keptDisabled" };
  return { status: "done", notice: answer.removed ? "done" : "nothing" };
}
