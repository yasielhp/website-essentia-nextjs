/**
 * Doubles and fixtures for the WhatsApp sender's tests. Nothing in the app
 * imports this file.
 */

import type { TemplateSend } from "@/lib/whatsapp/client";
import type {
  WhatsAppParamSource,
  WhatsAppSendResult,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import type { CampaignRow } from "@/types/campaign";
import type { QueuedRow } from "./dispatch";
import { chainDb, type FakeDbClient, type Step } from "./fake-db";

export const template = (
  overrides: Partial<WhatsAppTemplateRow> = {},
): WhatsAppTemplateRow => ({
  id: "tpl-1",
  meta_id: "meta-1",
  name: "reapertura",
  language: "es",
  category: "MARKETING",
  status: "APPROVED",
  header_format: null,
  header_text: null,
  body: "Hola {{1}}, volvemos el {{2}}",
  footer_text: null,
  buttons: [],
  param_count: 2,
  example_params: ["Ana", "2 de diciembre"],
  rejection_reason: null,
  unsupported_reason: null,
  synced_at: null,
  created_by: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  ...overrides,
});

export const SOURCES: WhatsAppParamSource[] = [
  { kind: "field", field: "first_name" },
  { kind: "static", value: "2 de diciembre" },
];

export const campaign = (overrides: Partial<CampaignRow> = {}): CampaignRow =>
  ({
    id: "camp-1",
    name: "Reapertura",
    status: "sending",
    channel: "whatsapp",
    kind: "standard",
    trigger: {},
    activated_at: null,
    created_at: "2026-11-01T00:00:00Z",
    audience: { language: "es", sendLocale: "es" },
    content: { whatsapp: { templateId: "tpl-1", params: SOURCES } },
    ...overrides,
  }) as unknown as CampaignRow;

export const row = (
  n: number,
  overrides: Partial<QueuedRow> = {},
): QueuedRow => ({
  id: `row-${n}`,
  contact_id: `contact-${n}`,
  email: null,
  phone: `+346000000${String(n).padStart(2, "0")}`,
  language: "es",
  variant: null,
  vars: null,
  contacts: {
    first_name: `Nombre${n}`,
    last_name: null,
    unsubscribe_token: null,
  },
  ...overrides,
});

export const rowsOf = (count: number): QueuedRow[] =>
  Array.from({ length: count }, (_, i) => row(i + 1));

/** A clock the test moves: `sleep` advances it, and so can a slow `send`. */
export function fakeClock(start = 1_000_000) {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

export const ok = (id: string): WhatsAppSendResult => ({
  status: "sent",
  providerId: id,
});

export function fakeSend(
  answer: (send: TemplateSend, call: number) => WhatsAppSendResult,
  clock?: ReturnType<typeof fakeClock>,
  latencyMs = 0,
) {
  const calls: TemplateSend[] = [];
  const send = async (s: TemplateSend) => {
    calls.push(s);
    clock?.advance(latencyMs);
    return answer(s, calls.length);
  };
  return { send, calls };
}

export type StoredRow = {
  id: string;
  campaign_id: string;
  status: string;
  error: string | null;
  provider_id: string | null;
  sent_at: string | null;
  claimed_at: string | null;
};

export type StoredContact = {
  id: string;
  whatsapp_opted_out_at: string | null;
  whatsapp_unreachable_at: string | null;
  whatsapp_marketing_opted_in_at: string | null;
};

/** A contact that may be sent a marketing message. */
export const consenting = (id: string): StoredContact => ({
  id,
  whatsapp_opted_out_at: null,
  whatsapp_unreachable_at: null,
  whatsapp_marketing_opted_in_at: "2026-10-01T00:00:00Z",
});

export type MemoryDbOptions = {
  template?: WhatsAppTemplateRow | null;
  readError?: string;
  /** Contacts that exist. Defaults to a consenting one for every queued row. */
  contacts?: StoredContact[] | "all-consenting";
  contactsError?: string;
  /** Makes this update fail: return a message to fail it, or throw. */
  failUpdate?: (query: {
    id: string | null;
    patch: Record<string, unknown>;
    attempt: number;
  }) => string | "throw" | null;
  /** Holds every update of `campaign_recipients` for this long. */
  updateDelayMs?: number;
  /** Called after each row is written, with the row's id and the patch. */
  onWrite?: (id: string, patch: Record<string, unknown>) => void;
  /** Rows some other process already moved on from `queued`. */
  rows?: Partial<StoredRow>[];
};

/**
 * An in-memory `campaign_recipients` (and just enough of `contacts` and
 * `whatsapp_templates`) behind the SDK's query shape, so a test reads the
 * rows' final state rather than the sequence of calls. `update ... eq("status",
 * "queued")` really matches nothing once a row has moved on, which is what the
 * per-row claim relies on.
 */
export function memoryDb(queued: QueuedRow[], opts: MemoryDbOptions = {}) {
  const rows = new Map<string, StoredRow>();
  for (const r of queued) {
    rows.set(r.id, {
      id: r.id,
      campaign_id: "camp-1",
      status: "queued",
      error: null,
      provider_id: null,
      sent_at: null,
      claimed_at: null,
    });
  }
  for (const patch of opts.rows ?? []) {
    const id = patch.id as string;
    rows.set(id, { ...(rows.get(id) as StoredRow), ...patch });
  }
  const contacts = new Map<string, StoredContact>();
  if (opts.contacts === undefined || opts.contacts === "all-consenting") {
    for (const r of queued) {
      if (r.contact_id) contacts.set(r.contact_id, consenting(r.contact_id));
    }
  } else {
    for (const c of opts.contacts) contacts.set(c.id, c);
  }

  const writes: { id: string; patch: Record<string, unknown> }[] = [];
  const attempts = new Map<string, number>();
  const reads: string[] = [];
  const contactReads: string[][] = [];

  const stepArgs = (chain: Step[], name: string) =>
    chain.filter((s) => s.name === name).map((s) => s.args);

  const { db, log } = chainDb(async (table, chain) => {
    if (table === "whatsapp_templates") {
      reads.push(table);
      if (opts.readError) {
        return { data: null, error: { message: opts.readError } };
      }
      return {
        data: "template" in opts ? opts.template : template(),
        error: null,
      };
    }

    if (table === "contacts") {
      const ids = (stepArgs(chain, "in")[0]?.[1] ?? []) as string[];
      contactReads.push(ids);
      if (opts.contactsError) {
        return { data: null, error: { message: opts.contactsError } };
      }
      return {
        data: ids.flatMap((id) => (contacts.has(id) ? [contacts.get(id)] : [])),
        error: null,
      };
    }

    if (table === "campaign_recipients") {
      const update = chain.find((s) => s.name === "update");
      if (!update) return { data: [], error: null };
      const patch = update.args[0] as Record<string, unknown>;
      const eqs = stepArgs(chain, "eq");
      const ins = stepArgs(chain, "in");
      const idEq = eqs.find((a) => a[0] === "id")?.[1] as string | undefined;
      const idIn = ins.find((a) => a[0] === "id")?.[1] as string[] | undefined;
      const statusEq = eqs.find((a) => a[0] === "status")?.[1];
      const ids = idEq !== undefined ? [idEq] : (idIn ?? []);

      const key = ids.join(",") + JSON.stringify(patch);
      const attempt = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, attempt);
      const failure = opts.failUpdate?.({
        id: idEq ?? null,
        patch,
        attempt,
      });
      if (opts.updateDelayMs) {
        await new Promise((r) => setTimeout(r, opts.updateDelayMs));
      }
      if (failure === "throw") throw new Error("socket closed");
      if (failure) return { data: null, error: { message: failure } };

      const matched: string[] = [];
      for (const id of ids) {
        const stored = rows.get(id);
        if (!stored) continue;
        if (statusEq !== undefined && stored.status !== statusEq) continue;
        Object.assign(stored, patch);
        matched.push(id);
        writes.push({ id, patch });
        opts.onWrite?.(id, patch);
      }
      return {
        data: chain.some((s) => s.name === "select")
          ? matched.map((id) => ({ id }))
          : null,
        error: null,
      };
    }
    return { data: [], error: null };
  });

  return {
    db: db as FakeDbClient,
    rows,
    contacts,
    writes,
    reads,
    contactReads,
    log,
    status: (id: string) => rows.get(id)?.status,
    error: (id: string) => rows.get(id)?.error,
  };
}
