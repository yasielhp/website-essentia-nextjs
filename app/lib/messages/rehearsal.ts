import type { CampaignLocale } from "@/types/campaign";
import type { MessageKey } from "./catalog";
import { composeMessageEmail } from "./compose";
import { fixedBlocksByKind } from "./fixed-blocks";
import { sampleFixed, sampleVars } from "./samples";
import type { EmailContentWrite } from "./schema";

/**
 * A trial render of what is about to be saved, down the same path the real
 * send takes (`composeMessageEmail`, with the example booking).
 *
 * The validator catches what it knows the renderer cannot take; this catches
 * the rest. A body that renders badly is not a harmless one: at send time the
 * failure falls back to the old email, so the admin's text would be saved,
 * shown as theirs, and never reach a client. Better to refuse it while they
 * are still looking at it.
 *
 * Only what the save carries is tried: a field it does not mention is already
 * in the row and was tried when it was saved. SERVER ONLY (it renders).
 * Run it after `validateMessageTemplate`, which is what keeps nodes the
 * renderer would treat as method calls out of the document.
 */
export async function rehearseRender(
  key: MessageKey,
  locale: CampaignLocale,
  content: EmailContentWrite,
  // Injectable so the "came back empty" answer can be tested.
  compose: typeof composeMessageEmail = composeMessageEmail,
): Promise<"ok" | "docNotRenderable"> {
  try {
    const out = await compose({
      key,
      locale,
      row: {
        subject: content.subject ?? null,
        preheader: content.preheader ?? null,
        title: content.title ?? null,
        doc: content.doc ?? null,
        enabled: true,
      },
      vars: sampleVars(key, locale),
      blocks: fixedBlocksByKind(key, sampleFixed(key, locale)),
    });
    return out.html.trim() === "" || out.subject.trim() === ""
      ? "docNotRenderable"
      : "ok";
  } catch {
    return "docNotRenderable";
  }
}
