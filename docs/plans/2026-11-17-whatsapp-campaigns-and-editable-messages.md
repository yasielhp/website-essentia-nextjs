# Campañas de WhatsApp, automatizaciones por canal y mensajes editables — Plan de implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** que el centro pueda enviar campañas y automatizaciones por WhatsApp con el mismo motor que ya usa para el email, y que todos los mensajes que salen del sistema (emails transaccionales y plantillas de WhatsApp) se vean y se editen desde el dashboard, no desde el código.

**Architecture:** el motor de campañas (`campaigns` + `campaign_recipients` + cron cada 15 min) gana una columna `channel` (`email | whatsapp`). Un envío de WhatsApp es una plantilla aprobada por Meta más el mapeo de sus parámetros; las plantillas viven en una tabla `whatsapp_templates` sincronizada con la Cloud API (lectura y creación), y Meta las aprueba. Los emails transaccionales se mueven a una tabla `message_templates` con un documento Maily editable y un fallback en código, renderizados por el mismo `campaignEmail()` de las campañas. Un nuevo área `/dashboard/messages` lista, edita, previsualiza y prueba todo. El consentimiento WhatsApp se guarda en `contacts` y se respeta en cada audiencia.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Insforge (Postgres), Meta WhatsApp Cloud API v21, Resend, `@maily-to/core` + `@maily-to/render`, Zod 4, `bun test`.

---

## Antes de empezar: lo que ya existe y en qué se apoya el plan

| Pieza                  | Dónde                                                                                   | Qué hace hoy                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Cliente Meta           | `app/lib/whatsapp/client.ts`                                                            | `sendTemplate({ to, params, buttonUrlParam })` con **una** plantilla fija (`essentia_booking_update`, idioma `es`). Nunca lanza. |
| Aviso a staff          | `app/lib/whatsapp/notify.ts`, `messages.ts`                                             | Un mensaje por evento de reserva al profesional + copia al admin. Se registra en `booking_events`.                               |
| Webhook Meta           | `app/api/webhooks/whatsapp/route.ts`                                                    | Firma HMAC, estados `delivered/read/failed` → `booking_events` por `provider_id`. Ignora mensajes entrantes.                     |
| Motor de campañas      | `app/lib/campaigns/{audience,audience-filter,automation-rules,automations,dispatch}.ts` | Segmentación, reglas de automatización (`after_booking`, `first_visit`, `birthday`…), envío por lotes con Resend.                |
| Formulario de campañas | `app/(dashboard)/dashboard/campaigns/_form/*`                                           | Reducer en `form-state.ts`; pasos tipo → trigger → audiencia → plantilla → contenido → revisión.                                 |
| Validación             | `app/lib/schemas.ts` (`campaignSchema`, `validateCampaign`)                             | Claves de mensaje contra `dashboard.validation.*`.                                                                               |
| Emails transaccionales | `app/emails/templates/*.ts`, `app/lib/bookings/notify.ts`                               | Funciones TS que devuelven HTML. El texto está en código.                                                                        |
| Renderizado Maily      | `app/emails/templates/campaign.ts` (`campaignEmail`)                                    | Envuelve un documento Maily con logo y pie, rellena `{{first_name}}` y `vars`.                                                   |
| Historial de reserva   | `app/lib/booking-events/record.ts`                                                      | `recordBookingEvent(s)` con canal `whatsapp                                                                                      | email | …`. |
| Cron                   | `vercel.json` → `/api/cron/campaigns` cada 15 min                                       | Envía programadas, reanuda atascadas, evalúa activas (`runAutomation`).                                                          |

**Restricciones de Meta que fijan el diseño** (no negociables, ver https://developers.facebook.com/docs/whatsapp/cloud-api):

1. Fuera de la ventana de 24 h tras el último mensaje del cliente, **solo** se pueden enviar plantillas aprobadas. Una campaña es siempre una plantilla. El texto se escribe en el dashboard, se sube a Meta por API y hay que esperar la aprobación (minutos a días).
2. Las plantillas de categoría `MARKETING` exigen opt-in explícito del destinatario. Lo guardamos en `contacts.whatsapp_opted_in_at`. Sin opt-in, la audiencia excluye al contacto.
3. Cada mensaje de plantilla tiene coste por país y categoría. No se inventan cifras en el dashboard: se enlaza a la página de precios de Meta y se muestra el recuento de destinatarios antes de enviar.
4. Un "STOP" o "BAJA" entrante debe respetarse. El webhook lo procesa y estampa `whatsapp_opted_out_at`.

**Variables de entorno nuevas** (añadir a `env.example` en la Tarea 1):

```
WHATSAPP_BUSINESS_ACCOUNT_ID=   # WABA id: lista y crea plantillas en /{WABA_ID}/message_templates
```

**Convenciones del repo que aplican a cada tarea:** `bun run format && bun run lint` limpios antes de cada commit; tests `bun test` solo para módulos puros; `requireRole`/`admin()` en toda Server Action; nunca re-exportar tipos desde un módulo `"use server"` (`app/lib/**/types.ts`); claves i18n en `messages/es/dashboard.json` **y** `messages/en/dashboard.json`; reiniciar `bun run dev` tras añadir claves.

---

## Reglas de ejecución y correcciones (revisión del 2026-11-17)

Este bloque manda sobre cualquier tarea de abajo que lo contradiga. Salió de revisar el plan contra la base de datos viva.

**Reglas de ejecución**

- **Solo rama.** Todo el trabajo va en `feat/whatsapp-campaigns`. Nadie hace merge ni push a `main` sin que el usuario lo pida: Vercel despliega desde ahí.
- **Un implementador a la vez.** Las tareas comparten `messages/{es,en}/dashboard.json`, `schemas.ts`, `types/campaign.ts`, `nav.tsx` y el reducer del formulario. Fases en paralelo solo con worktrees y ramas separadas.
- **La BD es producción.** `insforge db query` golpea la única BD viva. Backup previo hecho: `pre-whatsapp-campaigns-2026-11-17` (id `5cd59c5b-acf7-4230-82a2-1584c88d6773`, `completed`). Las migraciones son aditivas, van dentro de `BEGIN; … COMMIT;` y las que reemplazan funciones parten de la definición **viva** (`pg_get_functiondef`), no de la de este plan.
- **Revisión spec → calidad** tras cada tarea. En las tareas 3, 8, 12, 18 y 21 (rutas vivas) es obligatoria y por separado.
- **Verificación.** El centro no tiene número ni WABA registrados: todo paso que diga "llega al móvil" no se puede ejecutar y se informa como **no verificado**, nunca como hecho. Lo mismo para cualquier llamada real a Meta.
- Cada implementador recibe las reglas del repo: `bun run format && bun run lint` sin avisos, mensajes de commit en inglés, claves i18n en ES y EN con reinicio del dev server, y que `bun run build` solo no valida lo que cuelga de `app/actions/`.

**Defectos del plan, ya corregidos en las tareas**

1. Task 8: el índice único era parcial y `onConflict` del SDK solo nombra columnas. Pasa a no parcial (los NULL no colisionan).
2. Task 8: `record_campaign_event` marcaba `email_bounced_at` en un fallo de WhatsApp. Solo se marca en campañas de email.
3. Task 7: la `upsert_contact` viva ya maneja `newsletter_unsubscribed_at`. La versión del plan lo perdía. Se conserva.
4. Task 5: la baja por `ilike` a nueve dígitos no encuentra teléfonos guardados como `600 11 22 33`. Se compara `toE164(phone)` en código.
5. Task 10: la audiencia de WhatsApp se deduplica por teléfono E.164, o dos contactos con el mismo número rompen el índice único.
6. Task 13: `startsAt` se construye en Atlantic/Canary, no en UTC. `before_visit` y el recordatorio de la Task 21 se solapan: se avisa en el formulario.
7. Task 18: los templates antiguos quedan como respaldo hasta el final. Solo `booking_reminder` se puede apagar.
8. Task 3: se extrae el constructor del cuerpo y un test fija la forma que usa hoy el aviso a staff.

---

## Fases

| Fase | Entrega                                                                                                   | Depende de |
| ---- | --------------------------------------------------------------------------------------------------------- | ---------- |
| 1    | Consentimiento WhatsApp en contactos + plantillas de WhatsApp sincronizadas y creables desde el dashboard | —          |
| 2    | Campañas y automatizaciones con `channel = whatsapp` (envío, estados, informe)                            | 1          |
| 3    | Emails transaccionales editables desde el dashboard (`message_templates`)                                 | —          |
| 4    | WhatsApp transaccional al cliente (confirmación, recordatorio) con la plantilla elegida en el dashboard   | 1, 3       |

Las fases 1+2 y 3 son independientes y pueden ir en ramas distintas. La 4 cierra el círculo.

---

# FASE 1 — Consentimiento y plantillas de WhatsApp

### Task 1: Migración — consentimiento WhatsApp y tabla de plantillas

**Files:**

- Create: `insforge/migrations/20261117a_whatsapp_consent_and_templates.sql`
- Modify: `env.example:37-51` (bloque WhatsApp)

**Step 1: Escribir la migración**

```sql
-- Consentimiento WhatsApp por contacto. Misma regla que la newsletter: el
-- formulario solo pone el opt-in; quitarlo lo hace el propio cliente (STOP /
-- BAJA por WhatsApp) o el admin desde la ficha.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at  timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at timestamptz;

-- Copia local de las plantillas de la cuenta de WhatsApp Business. Meta es la
-- fuente de verdad del estado (APPROVED / PENDING / REJECTED); nosotros
-- guardamos el cuerpo para previsualizar y mapear parámetros sin ir a la red.
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id         text UNIQUE,                 -- id en Meta; null hasta que se crea allí
  name            text NOT NULL,               -- snake_case, único por idioma en Meta
  language        text NOT NULL DEFAULT 'es',  -- código Meta: es, en, en_US…
  category        text NOT NULL DEFAULT 'MARKETING', -- MARKETING | UTILITY
  status          text NOT NULL DEFAULT 'draft',     -- draft | PENDING | APPROVED | REJECTED | PAUSED | DISABLED
  header_text     text,
  body            text NOT NULL,               -- con {{1}}, {{2}}… tal como lo ve Meta
  footer_text     text,
  buttons         jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{type:'URL', text, url}] | [{type:'QUICK_REPLY', text}]
  param_count     int  NOT NULL DEFAULT 0,
  example_params  jsonb NOT NULL DEFAULT '[]'::jsonb, -- Meta exige ejemplos para aprobar
  rejection_reason text,
  synced_at       timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

-- Solo la clave de servicio la lee: RLS sin políticas, como campaigns.
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
```

**Step 2: Aplicar en Insforge**

Run: `npx @insforge/cli@latest db query "$(cat insforge/migrations/20261117a_whatsapp_consent_and_templates.sql)"`
Expected: `Query executed successfully.`

Verificar: `npx @insforge/cli@latest db query "select column_name from information_schema.columns where table_name='whatsapp_templates'"` → 17 filas.

**Step 3: Documentar la variable de entorno**

En `env.example`, dentro del bloque WhatsApp, añadir:

```
# Cuenta de WhatsApp Business (WABA). Con ella el dashboard lista y crea
# plantillas en /{WABA_ID}/message_templates. Sin ella, la pestaña de
# plantillas solo muestra las sincronizadas a mano.
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

**Step 4: Commit**

```bash
git add insforge/migrations/20261117a_whatsapp_consent_and_templates.sql env.example
git commit -m "feat(whatsapp): consent columns on contacts and a local copy of the Meta templates"
```

---

### Task 2: Tipos y parser de plantillas (puro)

El cuerpo de una plantilla Meta usa `{{1}}`, `{{2}}`… Necesitamos: contar parámetros, validar que son consecutivos desde 1, y renderizar una previsualización con valores.

**Files:**

- Create: `app/lib/whatsapp/templates.ts`
- Create: `app/lib/whatsapp/templates.test.ts`
- Modify: `app/lib/whatsapp/types.ts` (añadir tipos al final)

**Step 1: Tipos**

Añadir a `app/lib/whatsapp/types.ts`:

```ts
export type WhatsAppTemplateStatus =
  "draft" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED";

export type WhatsAppTemplateCategory = "MARKETING" | "UTILITY";

export type WhatsAppTemplateButton =
  | { type: "URL"; text: string; url: string }
  | { type: "QUICK_REPLY"; text: string };

export type WhatsAppTemplateRow = {
  id: string;
  meta_id: string | null;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  status: WhatsAppTemplateStatus;
  header_text: string | null;
  body: string;
  footer_text: string | null;
  buttons: WhatsAppTemplateButton[];
  param_count: number;
  example_params: string[];
  rejection_reason: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * De dónde sale cada {{n}} al enviar. `field` lee del contacto o de la
 * reserva; `static` es texto fijo escrito por el admin.
 */
export type WhatsAppParamSource =
  | { kind: "field"; field: WhatsAppParamField }
  | { kind: "static"; value: string };

export type WhatsAppParamField =
  | "first_name"
  | "last_name"
  | "service"
  | "session_type"
  | "date"
  | "time"
  | "post_title"
  | "post_url";
```

**Step 2: Test que falla**

`app/lib/whatsapp/templates.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  countParams,
  paramIssues,
  renderPreview,
} from "@/lib/whatsapp/templates";

describe("countParams", () => {
  test("counts the highest placeholder", () => {
    expect(countParams("Hola {{1}}, tu cita es el {{2}} a las {{3}}.")).toBe(3);
  });
  test("zero when there are none", () => {
    expect(countParams("Sin parámetros")).toBe(0);
  });
});

describe("paramIssues", () => {
  test("placeholders must run 1..n with no gaps", () => {
    expect(paramIssues("Hola {{1}} y {{3}}")).toEqual(["paramGap"]);
  });
  test("a body that starts or ends with a placeholder is refused by Meta", () => {
    expect(paramIssues("{{1}} te espera")).toEqual(["paramAtEdge"]);
    expect(paramIssues("Te espera {{1}}")).toEqual(["paramAtEdge"]);
  });
  test("clean body has no issues", () => {
    expect(paramIssues("Hola {{1}}, hasta pronto.")).toEqual([]);
  });
});

describe("renderPreview", () => {
  test("fills placeholders in order and leaves missing ones visible", () => {
    expect(renderPreview("Hola {{1}}, {{2}}.", ["Ana"])).toBe(
      "Hola Ana, {{2}}.",
    );
  });
});
```

**Step 3: Ejecutar y ver fallar**

Run: `bun test app/lib/whatsapp/templates.test.ts`
Expected: FAIL — `Cannot find module '@/lib/whatsapp/templates'`

**Step 4: Implementación mínima**

`app/lib/whatsapp/templates.ts`:

```ts
/**
 * Pure helpers over the text of a Meta template body.
 *
 * Meta's rules that matter here, from the template guidelines: placeholders
 * are `{{1}}`…`{{n}}`, consecutive from 1; a body may not start or end with
 * one; and every placeholder needs an example value to be reviewed.
 */

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

export function countParams(body: string): number {
  let max = 0;
  for (const match of body.matchAll(PLACEHOLDER)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

export type ParamIssue = "paramGap" | "paramAtEdge";

export function paramIssues(body: string): ParamIssue[] {
  const issues: ParamIssue[] = [];
  const seen = new Set<number>();
  for (const match of body.matchAll(PLACEHOLDER)) seen.add(Number(match[1]));
  const max = countParams(body);
  for (let i = 1; i <= max; i += 1) {
    if (!seen.has(i)) {
      issues.push("paramGap");
      break;
    }
  }
  const trimmed = body.trim();
  if (/^\{\{\d+\}\}/.test(trimmed) || /\{\{\d+\}\}$/.test(trimmed)) {
    issues.push("paramAtEdge");
  }
  return issues;
}

/** The body with the values in; an index with no value keeps its `{{n}}`. */
export function renderPreview(body: string, values: string[]): string {
  return body.replace(PLACEHOLDER, (whole, n: string) => {
    const value = values[Number(n) - 1];
    return value === undefined || value === "" ? whole : value;
  });
}
```

**Step 5: Ejecutar y ver pasar**

Run: `bun test app/lib/whatsapp/templates.test.ts`
Expected: `6 pass, 0 fail`

**Step 6: Commit**

```bash
git add app/lib/whatsapp/types.ts app/lib/whatsapp/templates.ts app/lib/whatsapp/templates.test.ts
git commit -m "feat(whatsapp): template body helpers — placeholder count, Meta's rules, preview"
```

---

### Task 3: Cliente Meta generalizado — enviar cualquier plantilla, listar y crear plantillas

Hoy `sendTemplate` solo sabe enviar `essentia_booking_update`. Se generaliza sin romper a los llamadores existentes.

**Files:**

- Modify: `app/lib/whatsapp/client.ts`

**Step 1: Añadir `sendTemplateMessage` y dejar `sendTemplate` como envoltorio**

Sustituir la función `sendTemplate` por:

```ts
export type TemplateSend = {
  to: string;
  name: string;
  /** Meta language code: `es`, `en`, `en_US`… */
  language: string;
  bodyParams: string[];
  /** One entry per URL button with a dynamic suffix, by button index. */
  buttonUrlParams?: { index: number; text: string }[];
};

/**
 * Sends one approved template message. Never throws (see above).
 */
export async function sendTemplateMessage(
  send: TemplateSend,
): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) return { status: "skipped" };

  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const components: unknown[] = [];
  if (send.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: send.bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  for (const button of send.buttonUrlParams ?? []) {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(button.index),
      parameters: [{ type: "text", text: button.text }],
    });
  }

  const body = {
    messaging_product: "whatsapp",
    to: send.to,
    type: "template",
    template: {
      name: send.name,
      language: { code: send.language },
      components,
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const failure = (await response
        .json()
        .catch(() => null)) as MetaResponse | null;
      const detail =
        failure?.error?.error_data?.details ??
        failure?.error?.message ??
        `HTTP ${response.status}`;
      return { status: "failed", error: detail };
    }
    const payload = (await response
      .json()
      .catch(() => null)) as MetaResponse | null;
    return { status: "sent", providerId: payload?.messages?.[0]?.id ?? null };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown WhatsApp error",
    };
  }
}

/** The staff notification, on the one template registered for it. */
export async function sendTemplate(opts: {
  to: string;
  params: string[];
  buttonUrlParam: string;
}): Promise<WhatsAppSendResult> {
  return sendTemplateMessage({
    to: opts.to,
    name: whatsAppTemplateName(),
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    bodyParams: opts.params,
    buttonUrlParams: [{ index: 0, text: opts.buttonUrlParam }],
  });
}
```

**Step 1b: Fijar la forma que usa hoy el aviso a staff (antes de tocar nada)**

Extraer el cuerpo de la petición a una función pura `buildTemplateBody(send: TemplateSend)` exportada de `app/lib/whatsapp/client.ts` (devuelve el objeto que se serializa), y que `sendTemplateMessage` la use. Escribir **antes** el test `app/lib/whatsapp/client.test.ts` contra el comportamiento antiguo y comprobar que pasa con `sendTemplate` tal como está en `main`:

```ts
import { describe, expect, test } from "bun:test";
import { buildTemplateBody } from "@/lib/whatsapp/client";

describe("buildTemplateBody", () => {
  test("keeps the shape the staff notification has always sent", () => {
    const body = buildTemplateBody({
      to: "+34600112233",
      name: "essentia_booking_update",
      language: "es",
      bodyParams: [
        "Yuli",
        "Se te ha asignado una sesión",
        "Ana",
        "Drenaje",
        "lunes, 09:00",
      ],
      buttonUrlParams: [{ index: 0, text: "booking-id" }],
    });
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "+34600112233",
      type: "template",
      template: {
        name: "essentia_booking_update",
        language: { code: "es" },
        components: [
          {
            type: "body",
            parameters: [
              "Yuli",
              "Se te ha asignado una sesión",
              "Ana",
              "Drenaje",
              "lunes, 09:00",
            ].map((text) => ({ type: "text", text })),
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: "booking-id" }],
          },
        ],
      },
    });
  });
  test("a template without parameters sends no body component", () => {
    const body = buildTemplateBody({
      to: "+34600112233",
      name: "hola",
      language: "es",
      bodyParams: [],
    });
    expect(body.template.components).toEqual([]);
  });
});
```

**Step 2: Añadir lectura y creación de plantillas en la WABA**

Al final de `client.ts`:

```ts
export function isTemplateApiConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  );
}

type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejected_reason?: string;
  components: {
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: string;
    text?: string;
    buttons?: { type: string; text: string; url?: string }[];
    example?: { body_text?: string[][] };
  }[];
};

export type RemoteTemplate = {
  metaId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  headerText: string | null;
  body: string;
  footerText: string | null;
  buttons: { type: string; text: string; url?: string }[];
  exampleParams: string[];
  rejectionReason: string | null;
};

function flatten(t: MetaTemplate): RemoteTemplate {
  const find = (type: MetaTemplate["components"][number]["type"]) =>
    t.components.find((c) => c.type === type);
  const header = find("HEADER");
  const body = find("BODY");
  return {
    metaId: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    headerText: header?.format === "TEXT" ? (header.text ?? null) : null,
    body: body?.text ?? "",
    footerText: find("FOOTER")?.text ?? null,
    buttons: find("BUTTONS")?.buttons ?? [],
    exampleParams: body?.example?.body_text?.[0] ?? [],
    rejectionReason: t.rejected_reason ?? null,
  };
}

/** Every template on the account, flattened. Throws on a network/API error. */
export async function listRemoteTemplates(): Promise<RemoteTemplate[]> {
  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const out: RemoteTemplate[] = [];
  let url: string | null =
    `https://graph.facebook.com/${version}/${waba}/message_templates?fields=id,name,language,category,status,rejected_reason,components&limit=100`;
  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Meta ${response.status}`);
    const page = (await response.json()) as {
      data: MetaTemplate[];
      paging?: { next?: string };
    };
    out.push(...page.data.map(flatten));
    url = page.paging?.next ?? null;
  }
  return out;
}

export type CreateTemplateInput = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  headerText?: string | null;
  body: string;
  footerText?: string | null;
  buttons: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[];
  exampleParams: string[];
};

/** Submits a template for review. Returns Meta's id and initial status. */
export async function createRemoteTemplate(
  input: CreateTemplateInput,
): Promise<{ id: string; status: string }> {
  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const components: unknown[] = [];
  if (input.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: input.headerText });
  }
  components.push({
    type: "BODY",
    text: input.body,
    ...(input.exampleParams.length > 0
      ? { example: { body_text: [input.exampleParams] } }
      : {}),
  });
  if (input.footerText)
    components.push({ type: "FOOTER", text: input.footerText });
  if (input.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: input.buttons });
  }
  const response = await fetch(
    `https://graph.facebook.com/${version}/${waba}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        language: input.language,
        category: input.category,
        components,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    status?: string;
    error?: { message?: string; error_user_msg?: string };
  } | null;
  if (!response.ok || !payload?.id) {
    throw new Error(
      payload?.error?.error_user_msg ??
        payload?.error?.message ??
        `Meta ${response.status}`,
    );
  }
  return { id: payload.id, status: payload.status ?? "PENDING" };
}
```

**Step 3: Verificar que nada se rompe**

Run: `npx tsc --noEmit -p . && bun test && bun run lint`
Expected: sin errores; los 252 tests siguen en verde.

**Step 4: Commit**

```bash
git add app/lib/whatsapp/client.ts
git commit -m "feat(whatsapp): the client sends any template and lists or submits templates on the WABA"
```

---

### Task 4: Server Actions de plantillas WhatsApp (listar, sincronizar, crear, borrar local)

**Files:**

- Create: `app/actions/whatsapp-templates.ts`
- Modify: `app/lib/schemas.ts` (al final, antes de `paymentSettingsSchema`)

**Step 1: Esquema Zod**

```ts
// ─── WhatsApp templates ───────────────────────────────────────
//
// Keys against `dashboard.validation.*`. Meta's naming rule for templates is
// lowercase letters, digits and underscores, up to 512 chars; the body may
// run to 1024 and placeholders must be 1..n consecutive and not at an edge.
export const whatsappTemplateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "nameRequired")
      .max(512, "nameTooLong")
      .regex(/^[a-z0-9_]+$/, "templateNameFormat"),
    language: z.enum(["es", "en"]),
    category: z.enum(["MARKETING", "UTILITY"]),
    headerText: z.string().trim().max(60, "headerTooLong").optional(),
    body: z.string().trim().min(1, "bodyRequired").max(1024, "bodyTooLong"),
    footerText: z.string().trim().max(60, "footerTooLong").optional(),
    buttons: z
      .array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("URL"),
            text: z.string().trim().min(1).max(25),
            url: z.string().url().startsWith("https://", "urlMustBeHttps"),
          }),
          z.object({
            type: z.literal("QUICK_REPLY"),
            text: z.string().trim().min(1).max(25),
          }),
        ]),
      )
      .max(3, "tooManyButtons"),
    exampleParams: z.array(z.string().trim().min(1, "exampleRequired")),
  })
  .superRefine((value, ctx) => {
    for (const issue of paramIssues(value.body)) {
      ctx.addIssue({ code: "custom", path: ["body"], message: issue });
    }
    if (value.exampleParams.length !== countParams(value.body)) {
      ctx.addIssue({
        code: "custom",
        path: ["exampleParams"],
        message: "exampleCountMismatch",
      });
    }
  });

export type WhatsAppTemplateInput = z.infer<typeof whatsappTemplateSchema>;
```

Importar arriba del archivo: `import { countParams, paramIssues } from "@/lib/whatsapp/templates";`

Añadir las claves nuevas a `CAMPAIGN_MESSAGE_KEYS` **no** (son de otro formulario); en su lugar añadir las traducciones en `dashboard.validation` (Task 6): `templateNameFormat`, `headerTooLong`, `footerTooLong`, `tooManyButtons`, `exampleRequired`, `exampleCountMismatch`, `paramMalformed`, `paramGap`, `paramAtEdge`.

**Step 2: Acciones**

`app/actions/whatsapp-templates.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { admin, authFailure, type AuthContext } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  createRemoteTemplate,
  isTemplateApiConfigured,
  listRemoteTemplates,
} from "@/lib/whatsapp/client";
import { countParams } from "@/lib/whatsapp/templates";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import {
  whatsappTemplateSchema,
  type WhatsAppTemplateInput,
} from "@/lib/schemas";

const PATH = "/dashboard/messages";

type Failure = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
};

export async function listWhatsAppTemplates(
  accessToken: string | null,
): Promise<
  { ok: true; templates: WhatsAppTemplateRow[]; configured: boolean } | Failure
> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const { data, error } = await getAdminClient()
    .database.from("whatsapp_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return { ok: false, error: "db" };
  return {
    ok: true,
    templates: (data ?? []) as WhatsAppTemplateRow[],
    configured: isTemplateApiConfigured(),
  };
}

/** Pulls every template from Meta and upserts it by (name, language). */
export async function syncWhatsAppTemplates(
  accessToken: string | null,
): Promise<{ ok: true; count: number } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  if (!isTemplateApiConfigured())
    return { ok: false, error: "whatsapp_not_configured" };

  let remote;
  try {
    remote = await listRemoteTemplates();
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const now = new Date().toISOString();
  const { error } = await getAdminClient()
    .database.from("whatsapp_templates")
    .upsert(
      remote.map((t) => ({
        meta_id: t.metaId,
        name: t.name,
        language: t.language,
        category: t.category === "UTILITY" ? "UTILITY" : "MARKETING",
        status: t.status,
        header_text: t.headerText,
        body: t.body,
        footer_text: t.footerText,
        buttons: t.buttons,
        param_count: countParams(t.body),
        example_params: t.exampleParams,
        rejection_reason: t.rejectionReason,
        synced_at: now,
        updated_at: now,
      })),
      { onConflict: "name,language" },
    );
  if (error) return { ok: false, error: "db" };
  revalidatePath(PATH);
  return { ok: true, count: remote.length };
}

/**
 * Saves the template locally and, when the WABA is configured, submits it to
 * Meta for review. Without the WABA it stays `draft`, visible but unusable.
 */
export async function createWhatsAppTemplate(
  accessToken: string | null,
  input: WhatsAppTemplateInput,
): Promise<{ ok: true; id: string; status: string } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const parsed = whatsappTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "invalid", fieldErrors };
  }
  const value = parsed.data;

  let metaId: string | null = null;
  let status = "draft";
  if (isTemplateApiConfigured()) {
    try {
      const created = await createRemoteTemplate({
        name: value.name,
        language: value.language,
        category: value.category,
        headerText: value.headerText ?? null,
        body: value.body,
        footerText: value.footerText ?? null,
        buttons: value.buttons,
        exampleParams: value.exampleParams,
      });
      metaId = created.id;
      status = created.status;
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await getAdminClient()
    .database.from("whatsapp_templates")
    .upsert(
      {
        meta_id: metaId,
        name: value.name,
        language: value.language,
        category: value.category,
        status,
        header_text: value.headerText ?? null,
        body: value.body,
        footer_text: value.footerText ?? null,
        buttons: value.buttons,
        param_count: countParams(value.body),
        example_params: value.exampleParams,
        created_by: caller.userId,
        updated_at: now,
      },
      { onConflict: "name,language" },
    )
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "db" };
  revalidatePath(PATH);
  return { ok: true, id: (data as { id: string }).id, status };
}

/** Removes the local copy only; Meta keeps its own. */
export async function deleteWhatsAppTemplate(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const { error } = await getAdminClient()
    .database.from("whatsapp_templates")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "db" };
  revalidatePath(PATH);
  return { ok: true };
}
```

Comprobar primero cómo exporta `app/lib/auth-guard.ts` a `admin` y `authFailure` (los usa `app/actions/campaigns.ts:479-483`); copiar exactamente esos imports.

**Step 3: Tipos y lint**

Run: `npx tsc --noEmit -p . && bun run lint`
Expected: limpio.

**Step 4: Commit**

```bash
git add app/actions/whatsapp-templates.ts app/lib/schemas.ts
git commit -m "feat(whatsapp): admin actions to list, sync, submit and drop templates"
```

---

### Task 5: Webhook — estado de plantillas y bajas entrantes (STOP / BAJA)

**Files:**

- Modify: `app/api/webhooks/whatsapp/route.ts`

**Step 1: Ampliar el tipo del cuerpo**

Sustituir `MetaWebhookBody` por:

```ts
type MetaWebhookBody = {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        statuses?: MetaStatus[];
        messages?: { from?: string; id?: string; text?: { body?: string } }[];
        // field === "message_template_status_update"
        event?: string; // APPROVED | REJECTED | PAUSED | DISABLED | PENDING
        message_template_id?: string | number;
        message_template_name?: string;
        message_template_language?: string;
        reason?: string;
      };
    }[];
  }[];
};
```

**Step 2: Procesar cambios de estado de plantilla y bajas, antes del `if (statuses.length === 0)`**

```ts
const db = getAdminClient().database;

// Template reviews: Meta tells us here, and nowhere else, when a template
// we submitted is approved or refused.
const templateUpdates = (payload.entry ?? []).flatMap((entry) =>
  (entry.changes ?? []).filter(
    (c) => c.field === "message_template_status_update" && c.value?.event,
  ),
);
for (const change of templateUpdates) {
  const v = change.value!;
  await db
    .from("whatsapp_templates")
    .update({
      status: v.event,
      rejection_reason: v.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("name", v.message_template_name ?? "")
    .eq("language", v.message_template_language ?? "");
}

// Opt-outs. The centre answers WhatsApp by hand, but a STOP has to be
// honoured by the machine: it stamps the contact and every audience from
// now on leaves them out.
const inbound = (payload.entry ?? []).flatMap((entry) =>
  (entry.changes ?? []).flatMap((c) => c.value?.messages ?? []),
);
for (const message of inbound) {
  const text = message.text?.body?.trim().toUpperCase() ?? "";
  if (!message.from || !["STOP", "BAJA", "CANCELAR"].includes(text)) continue;
  // Phones are stored however a form wrote them (`600 11 22 33`, `600-112-233`),
  // so SQL cannot match them reliably. Load the opted-in contacts and compare
  // the normalised numbers in code.
  const from = toE164(`+${message.from.replace(/\D/g, "")}`);
  if (!from) continue;
  const { data: optedIn } = await db
    .from("contacts")
    .select("id, phone")
    .not("whatsapp_opted_in_at", "is", null)
    .is("whatsapp_opted_out_at", null);
  const ids = ((optedIn ?? []) as { id: string; phone: string | null }[])
    .filter((c) => toE164(c.phone) === from)
    .map((c) => c.id);
  if (ids.length > 0) {
    await db
      .from("contacts")
      .update({ whatsapp_opted_out_at: new Date().toISOString() })
      .in("id", ids);
  }
}
```

Mover la línea `const db = getAdminClient().database;` que ya existía más abajo (quitar la duplicada). Importar `toE164` de `@/lib/whatsapp/client`. Añadir un test puro `app/lib/whatsapp/optout.test.ts` si la comparación se extrae a una función (`matchOptOut(from, contacts)`): `600 11 22 33`, `600-112-233` y `+34600112233` deben coincidir con `34600112233`.

**Step 3: Comprobar en local con un payload firmado**

Crear `scratch/webhook-test.sh` **fuera del repo** (scratchpad) que firme un JSON con `WHATSAPP_APP_SECRET` y lo envíe a `http://localhost:3000/api/webhooks/whatsapp`:

```bash
BODY='{"entry":[{"changes":[{"field":"message_template_status_update","value":{"event":"APPROVED","message_template_name":"prueba_plan","message_template_language":"es"}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | awk '{print $2}')
curl -s -X POST http://localhost:3000/api/webhooks/whatsapp -H "Content-Type: application/json" -H "x-hub-signature-256: sha256=$SIG" -d "$BODY"
```

Expected: `{"received":true}` y, si existe una fila `prueba_plan/es`, su `status` pasa a `APPROVED`.

**Step 4: Commit**

```bash
git add app/api/webhooks/whatsapp/route.ts
git commit -m "feat(whatsapp): the webhook records template reviews and honours STOP/BAJA"
```

---

### Task 6: Dashboard — área "Mensajes" con la pestaña de plantillas de WhatsApp

Nueva ruta `/dashboard/messages` con pestañas: **Plantillas de WhatsApp** (esta tarea), **Emails** (Fase 3). Reutiliza los patrones de `app/(dashboard)/dashboard/campaigns/` (tabla, `StatusBadge`, modales `fixed inset-0 z-50`).

**Files:**

- Create: `app/(dashboard)/dashboard/messages/page.tsx`
- Create: `app/(dashboard)/dashboard/messages/messages-tabs.tsx`
- Create: `app/(dashboard)/dashboard/messages/whatsapp/template-table.tsx`
- Create: `app/(dashboard)/dashboard/messages/whatsapp/template-form.tsx`
- Create: `app/(dashboard)/dashboard/messages/whatsapp/template-preview.tsx`
- Modify: `app/constants/nav.tsx:23` (añadir `{ key: "messages", href: "/dashboard/messages" }` tras campaigns)
- Modify: `messages/es/dashboard.json`, `messages/en/dashboard.json` (namespace `dashboard.messages.*`, `dashboard.nav.messages`, claves de validación de Task 4)

**Step 1: Página servidor con guard de rol**

Copiar la estructura de `app/(dashboard)/dashboard/campaigns/page.tsx` (cómo resuelve el rol y qué devuelve si no es admin) y renderizar `<MessagesTabs />`.

**Step 2: Tabla de plantillas**

`template-table.tsx` (cliente): columnas Nombre · Idioma · Categoría · Estado (badge: `APPROVED` verde, `PENDING` ámbar, `REJECTED` rojo con tooltip `rejection_reason`, `draft` gris) · Parámetros · Actualizada. Botones: **Sincronizar con Meta** (`syncWhatsAppTemplates`), **Nueva plantilla** (abre `template-form`). Si `configured === false`, aviso: "Falta `WHATSAPP_BUSINESS_ACCOUNT_ID`: las plantillas se guardan en borrador y no se envían a revisión".

**Step 3: Formulario de plantilla**

`template-form.tsx`: campos nombre (ayuda: minúsculas, dígitos y `_`), idioma (es/en), categoría (MARKETING/UTILITY con una línea explicando que MARKETING exige opt-in y cuesta más), cabecera opcional, cuerpo (textarea; debajo, contador de `{{n}}` en vivo con `countParams`), pie opcional, hasta 3 botones (URL https o respuesta rápida), y **un campo de ejemplo por parámetro** (Meta no revisa sin ejemplos). Errores por campo de `fieldErrors` con claves `dashboard.validation.*`. Al guardar: `createWhatsAppTemplate` → toast "Enviada a revisión" o "Guardada como borrador".

**Step 4: Previsualización**

`template-preview.tsx`: burbuja estilo WhatsApp (fondo `#e7fed6`, esquina, hora) con `renderPreview(body, exampleParams)`, cabecera en negrita, pie en gris pequeño y botones debajo. Se usa en el formulario (en vivo) y en la tabla (al pulsar una fila).

**Step 5: i18n**

`messages/es/dashboard.json` → `dashboard.nav.messages: "Mensajes"`, `dashboard.messages.title: "Mensajes"`, `dashboard.messages.tabs.{whatsapp,email}`, `dashboard.messages.whatsapp.{sync,new,notConfigured,status.*,fields.*,help.*,toasts.*}`. Equivalente en inglés. Validación: `templateNameFormat: "Solo minúsculas, números y guion bajo."`, `paramMalformed: "Usa solo parámetros con la forma {{1}}, {{2}}… (de 1 a 50, sin espacios)."`, `paramGap: "Los parámetros deben ir seguidos: {{1}}, {{2}}, {{3}}…"`, `paramAtEdge: "Meta no acepta un parámetro al principio o al final del texto."`, `exampleCountMismatch: "Falta un ejemplo por cada parámetro."`, `headerTooLong`, `footerTooLong`, `tooManyButtons`, `exampleRequired`.

**Step 6: Verificar en el navegador**

Run: `bun run dev` (reiniciar si ya corría: hay claves nuevas). Abrir `/dashboard/messages` como admin: crear plantilla `prueba_plan` con cuerpo `Hola {{1}}, ya puedes reservar tu sesión de {{2}}.` y ejemplos `Ana`, `drenaje`. Expected: fila con estado `PENDING` (o `draft` sin WABA) y previsualización correcta.

**Step 7: Commit**

```bash
git add app/(dashboard)/dashboard/messages app/constants/nav.tsx messages/es/dashboard.json messages/en/dashboard.json
git commit -m "feat(dashboard): a Messages area that lists, previews, submits and syncs WhatsApp templates"
```

---

### Task 7: Opt-in de WhatsApp en formularios y ficha de contacto

Misma regla que la newsletter: la casilla marcada pone `whatsapp_opted_in_at = now()` si estaba vacío; sin marcar, no toca nada.

**Files:**

- Modify: `insforge/migrations/20261117b_upsert_contact_whatsapp.sql` (nuevo; `upsert_contact` gana `p_whatsapp boolean DEFAULT NULL`)
- Modify: `app/lib/schemas.ts` (`bookingDetailsSchema`: `whatsapp: z.boolean().optional()`)
- Modify: `app/components/sections/booking/*` (casilla "Avisarme por WhatsApp de mi reserva" junto a la de newsletter; buscar `newsletter` en ese directorio para el sitio exacto)
- Modify: `app/(dashboard)/dashboard/contacts/[id]/*` (toggle "WhatsApp: acepta mensajes" con fecha de alta/baja; buscar `newsletter_subscribed` para el patrón)
- Modify: `messages/{es,en}/booking.json`, `messages/{es,en}/dashboard.json`

**Step 1: Migración de la función**

**Parte de la definición viva**, que ya incluye `newsletter_unsubscribed_at` (volcado en el scratchpad `fn-upsert_contact.txt`). Solo se añade `p_whatsapp`; nada de lo existente se quita. Va dentro de una transacción.

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.upsert_contact(text, text, text, text, text, text, boolean);
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email text, p_first_name text, p_last_name text, p_phone text,
  p_language text DEFAULT 'en', p_gender text DEFAULT NULL,
  p_newsletter boolean DEFAULT NULL, p_whatsapp boolean DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id UUID;
BEGIN
  INSERT INTO contacts (email, first_name, last_name, phone, preferred_language, gender,
                        newsletter_subscribed, newsletter_subscribed_at, whatsapp_opted_in_at)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language, p_gender,
          COALESCE(p_newsletter, false),
          CASE WHEN p_newsletter THEN now() ELSE NULL END,
          CASE WHEN p_whatsapp THEN now() ELSE NULL END)
  ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone,
    preferred_language = EXCLUDED.preferred_language,
    gender = COALESCE(EXCLUDED.gender, contacts.gender),
    newsletter_subscribed = CASE WHEN p_newsletter THEN true ELSE contacts.newsletter_subscribed END,
    newsletter_subscribed_at = CASE WHEN p_newsletter AND NOT COALESCE(contacts.newsletter_subscribed, false)
                                    THEN now() ELSE contacts.newsletter_subscribed_at END,
    newsletter_unsubscribed_at = CASE WHEN p_newsletter THEN NULL
                                      ELSE contacts.newsletter_unsubscribed_at END,
    whatsapp_opted_in_at = CASE WHEN p_whatsapp AND contacts.whatsapp_opted_in_at IS NULL
                                THEN now() ELSE contacts.whatsapp_opted_in_at END,
    whatsapp_opted_out_at = CASE WHEN p_whatsapp THEN NULL ELSE contacts.whatsapp_opted_out_at END,
    updated_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;
COMMIT;
```

Aplicar con el CLI como en Task 1. Después comprobar que la firma vieja de siete argumentos sigue funcionando: `select public.upsert_contact('plan-test@example.com','A','B',null,'es',null,null)` y borrar esa fila de prueba. Buscar todos los `rpc("upsert_contact"` del repo (`grep -rn upsert_contact app`) y pasar `p_whatsapp` donde haya casilla.

**Step 2: Casilla en el formulario público de reserva**

Texto ES: "Quiero recibir por WhatsApp la confirmación y el recordatorio de mi cita." EN: "Send me my booking confirmation and reminder on WhatsApp." Debajo, en pequeño: "Puedes darte de baja respondiendo BAJA."

**Step 3: Ficha de contacto**

Fila con el estado: "Acepta WhatsApp desde 12/11/2026" / "Se dio de baja el …" / "Sin consentimiento". Toggle para el admin (acción nueva `setWhatsAppConsent(accessToken, contactId, boolean)` en `app/actions/contacts.ts` con `requireRole`), que estampa `opted_in_at` o `opted_out_at`.

**Step 4: Commit**

```bash
git commit -am "feat(contacts): WhatsApp consent — booking checkbox, contact card toggle, upsert_contact"
```

---

# FASE 2 — Campañas y automatizaciones por WhatsApp

### Task 8: Migración — canal en campañas, teléfono en destinatarios

**Files:**

- Create: `insforge/migrations/20261117c_campaign_channel.sql`

```sql
BEGIN;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email'; -- email | whatsapp

-- A WhatsApp recipient is a phone; email may be absent for walk-in clients.
ALTER TABLE campaign_recipients
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Not partial on purpose: the SDK's onConflict names columns only and cannot
-- target a partial index. Postgres never treats two NULLs as equal, so the
-- email rows (phone NULL) are not affected.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_unique_phone_cycle
  ON campaign_recipients (campaign_id, phone, cycle);

-- Written from the LIVE definition (scratchpad fn-record_campaign_event.txt).
-- Two changes: Meta's `read`/`failed` map onto `opened`/`bounced` for WhatsApp
-- campaigns, and `email_bounced_at` is stamped only for email campaigns: a
-- number without WhatsApp says nothing about the inbox.
CREATE OR REPLACE FUNCTION public.record_campaign_event(
  p_provider_id text, p_event text, p_at timestamptz, p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_row campaign_recipients%ROWTYPE;
  v_channel text;
  v_event text;
  v_rank_now int;
  v_rank_new int;
BEGIN
  SELECT * INTO v_row FROM campaign_recipients WHERE provider_id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT channel INTO v_channel FROM campaigns WHERE id = v_row.campaign_id;
  v_event := CASE
    WHEN v_channel = 'whatsapp' AND p_event = 'read'   THEN 'opened'
    WHEN v_channel = 'whatsapp' AND p_event = 'failed' THEN 'bounced'
    ELSE p_event END;

  -- Terminal states never move again.
  IF v_row.status IN ('bounced', 'complained', 'failed') THEN RETURN false; END IF;

  v_rank_now := CASE v_row.status
    WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4 ELSE 0 END;
  v_rank_new := CASE v_event
    WHEN 'delivered' THEN 2 WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 9 WHEN 'complained' THEN 9 ELSE 0 END;

  IF v_rank_new = 0 OR v_rank_new <= v_rank_now THEN RETURN false; END IF;

  UPDATE campaign_recipients SET
    status = v_event,
    error = COALESCE(p_error, error),
    delivered_at = CASE WHEN v_event IN ('delivered','opened','clicked') THEN COALESCE(delivered_at, p_at) ELSE delivered_at END,
    opened_at    = CASE WHEN v_event IN ('opened','clicked') THEN COALESCE(opened_at, p_at) ELSE opened_at END,
    read_at      = CASE WHEN v_channel = 'whatsapp' AND p_event = 'read' THEN COALESCE(read_at, p_at) ELSE read_at END,
    clicked_at   = CASE WHEN v_event = 'clicked' THEN COALESCE(clicked_at, p_at) ELSE clicked_at END
  WHERE id = v_row.id;

  -- Counters are "reached at least this state": a click implies an open and a
  -- delivery, so an opened row that jumps to clicked bumps only clicked, while
  -- a sent row that jumps straight to clicked bumps all three.
  UPDATE campaigns SET
    delivered_count  = delivered_count  + CASE WHEN v_rank_new >= 2 AND v_rank_now < 2 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    opened_count     = opened_count     + CASE WHEN v_rank_new >= 3 AND v_rank_now < 3 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    clicked_count    = clicked_count    + CASE WHEN v_rank_new >= 4 AND v_rank_now < 4 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    bounced_count    = bounced_count    + CASE WHEN v_event = 'bounced' THEN 1 ELSE 0 END,
    complained_count = complained_count + CASE WHEN v_event = 'complained' THEN 1 ELSE 0 END
  WHERE id = v_row.campaign_id;

  IF v_event IN ('bounced', 'complained')
     AND v_channel IS DISTINCT FROM 'whatsapp'
     AND v_row.contact_id IS NOT NULL THEN
    UPDATE contacts SET email_bounced_at = COALESCE(email_bounced_at, p_at)
    WHERE id = v_row.contact_id;
  END IF;

  RETURN true;
END; $function$;

COMMIT;
```

**Antes de aplicar:** probar el índice con un upsert real dentro de una transacción que se deshace (`BEGIN; INSERT … ON CONFLICT (campaign_id, phone, cycle) DO NOTHING …; ROLLBACK;`) y comprobar que una fila de email (teléfono NULL) sigue insertándose. Después del `COMMIT`, comprobar que el webhook de Resend sigue funcionando: la función de email se comporta igual porque el canal por defecto es `email`. Aplicar y commitear:

```bash
git add insforge/migrations/20261117c_campaign_channel.sql
git commit -m "feat(campaigns): a channel per campaign and a phone per recipient"
```

---

### Task 9: Tipos y validación del canal WhatsApp

**Files:**

- Modify: `app/types/campaign.ts`
- Modify: `app/lib/schemas.ts` (`campaignSchema`, `campaignDraftSchema`, `CAMPAIGN_MESSAGE_KEYS`)
- Modify: `app/lib/campaigns/validate.test.ts`

**Step 1: Tipos**

En `app/types/campaign.ts`:

```ts
export type CampaignChannel = "email" | "whatsapp";

/** The `content.whatsapp` block: which approved template and what fills it. */
export type WhatsAppContent = {
  templateId: string | null; // whatsapp_templates.id
  params: WhatsAppParamSource[]; // one per {{n}}, in order
};
```

Importar `WhatsAppParamSource` desde `@/lib/whatsapp/types`. Añadir `channel: CampaignChannel` a `CampaignRow` y a `CampaignInput`; `whatsapp?: WhatsAppContent` a `CampaignContent` (hacerlo `Record<CampaignLocale, CampaignLocaleContent> & { whatsapp?: WhatsAppContent }`); `phone: string | null` y `email: string | null` a `CampaignRecipientRow`.

**Step 2: Test que falla** (añadir a `validate.test.ts`)

```ts
describe("a WhatsApp campaign", () => {
  const whatsapp = {
    ...campaign,
    channel: "whatsapp" as const,
    content: {
      en: empty,
      es: empty,
      whatsapp: {
        templateId: "6f1c2a3e-1111-4222-8333-444455556666",
        params: [{ kind: "field" as const, field: "first_name" as const }],
      },
    },
  };
  test("needs a template and nothing in the email blocks", () => {
    expect(validateCampaign(whatsapp).ok).toBe(true);
  });
  test("refuses an empty template", () => {
    const r = validateCampaign({
      ...whatsapp,
      content: {
        ...whatsapp.content,
        whatsapp: { templateId: null, params: [] },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors["content.whatsapp.templateId"]).toBe("templateRequired");
  });
  test("an email campaign ignores the whatsapp block", () => {
    expect(validateCampaign({ ...campaign, channel: "email" }).ok).toBe(true);
  });
});
```

Run: `bun test app/lib/campaigns/validate.test.ts` → FAIL (`channel` desconocido / `templateRequired` ausente).

**Step 3: Esquema**

En `schemas.ts`:

```ts
export const campaignChannelSchema = z.enum(["email", "whatsapp"]);

const whatsappParamSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("field"),
    field: z.enum([
      "first_name",
      "last_name",
      "service",
      "session_type",
      "date",
      "time",
      "post_title",
      "post_url",
    ]),
  }),
  z.object({
    kind: z.literal("static"),
    value: z.string().trim().max(200, "paramTooLong"),
  }),
]);

const whatsappContentSchema = z.object({
  templateId: z.uuid("templateRequired").nullable(),
  params: z.array(whatsappParamSchema).max(20),
});
```

`campaignContentSchema` y el `content` del draft ganan `whatsapp: whatsappContentSchema.optional()`. `campaignSchema` y `campaignDraftSchema` ganan `channel: campaignChannelSchema.default("email")`. En el `superRefine` de `campaignSchema`, envolver el bucle de idiomas en `if (value.channel === "email") { … } else { if (!value.content.whatsapp?.templateId) ctx.addIssue({ code: "custom", path: ["content", "whatsapp", "templateId"], message: "templateRequired" }); }`. Añadir `templateRequired`, `paramTooLong` a `CAMPAIGN_MESSAGE_KEYS` y a `dashboard.validation` (ES/EN).

**Step 4: Pasar tests y commit**

Run: `bun test` → todo verde (el test "kind and trigger are part of the payload" sigue pasando porque `channel` tiene default).

```bash
git add app/types/campaign.ts app/lib/schemas.ts app/lib/campaigns/validate.test.ts messages/es/dashboard.json messages/en/dashboard.json
git commit -m "feat(campaigns): a campaign has a channel; a WhatsApp one is a template plus its parameters"
```

---

### Task 10: Audiencia por canal (puro + resolver)

Para `whatsapp`: solo contactos con teléfono E.164 válido, `whatsapp_opted_in_at` puesto y `whatsapp_opted_out_at` vacío. El email deja de ser obligatorio.

**Files:**

- Modify: `app/lib/campaigns/audience-filter.ts`
- Modify: `app/lib/campaigns/audience-filter.test.ts`
- Modify: `app/lib/campaigns/audience.ts` (`loadCandidates` selecciona `whatsapp_opted_in_at, whatsapp_opted_out_at`; `resolveAudience(audience, now, channel = "email")`)

**Step 1: Test que falla**

```ts
test("a WhatsApp audience keeps only opted-in contacts with a mobile", () => {
  const base = candidate({
    email: "",
    phone: "600112233",
    whatsappOptedInAt: "2026-11-01T00:00:00Z",
  });
  const noPhone = candidate({
    id: "b",
    phone: null,
    whatsappOptedInAt: "2026-11-01T00:00:00Z",
  });
  const noConsent = candidate({ id: "c", phone: "600112244" });
  const optedOut = candidate({
    id: "d",
    phone: "600112255",
    whatsappOptedInAt: "2026-11-01T00:00:00Z",
    whatsappOptedOutAt: "2026-11-10T00:00:00Z",
  });
  const out = filterAudience(
    [base, noPhone, noConsent, optedOut],
    EMPTY_AUDIENCE,
    { channel: "whatsapp", now },
  );
  expect(out.map((r) => r.id)).toEqual([base.id]);
  expect(out[0].phone).toBe("+34600112233");
});
```

Ver cómo construye `candidate(...)` y llama a `filterAudience` el test existente y copiar la firma exacta.

**Step 2: Implementación**

`ContactCandidate` gana `whatsappOptedInAt?: string | null; whatsappOptedOutAt?: string | null`. `filterAudience` acepta `{ channel?: CampaignChannel }` en sus opciones; en la exclusión fija:

```ts
if (channel === "whatsapp") {
  const phone = toE164(c.phone);
  if (!phone || !c.whatsappOptedInAt || c.whatsappOptedOutAt) return false;
} else {
  if (!c.email || c.bouncedAt || c.unsubscribedAt) return false;
}
```

y el `Recipient` resultante lleva `phone` normalizado. `toE164` se importa de `@/lib/whatsapp/client` — ese módulo lee `process.env` solo dentro de funciones, así que es seguro en un test.

**Deduplicar por teléfono.** Con canal `whatsapp`, dos contactos con el mismo número E.164 (una madre y su hija, un fijo compartido) dejan solo el primero. Sin esto chocan con el índice único `(campaign_id, phone, cycle)` y pueden tumbar un envío único entero. Test: dos candidatos con `600112233` y `600 11 22 33` devuelven uno.

**Step 3: Pasar, commit**

```bash
git add app/lib/campaigns/audience-filter.ts app/lib/campaigns/audience-filter.test.ts app/lib/campaigns/audience.ts
git commit -m "feat(campaigns): a WhatsApp audience is opted-in mobiles; email is optional there"
```

---

### Task 11: Parámetros por destinatario (puro)

Convierte `WhatsAppParamSource[]` + un `Recipient` + `vars` en el `string[]` que viaja a Meta.

**Files:**

- Create: `app/lib/campaigns/whatsapp-params.ts`
- Create: `app/lib/campaigns/whatsapp-params.test.ts`

**Step 1: Test**

```ts
import { describe, expect, test } from "bun:test";
import { resolveParams } from "@/lib/campaigns/whatsapp-params";

const recipient = {
  id: "r",
  email: "a@b.c",
  firstName: "Ana",
  lastName: "Pérez",
  language: "es" as const,
  phone: "+34600112233",
};

describe("resolveParams", () => {
  test("fields come from the recipient, statics as written, vars from the rule", () => {
    expect(
      resolveParams(
        [
          { kind: "field", field: "first_name" },
          { kind: "static", value: "drenaje" },
          { kind: "field", field: "post_title" },
        ],
        recipient,
        { post_title: "Volvemos" },
      ),
    ).toEqual(["Ana", "drenaje", "Volvemos"]);
  });
  test("an empty value becomes a dash: Meta rejects empty parameters", () => {
    expect(
      resolveParams([{ kind: "field", field: "last_name" }], {
        ...recipient,
        lastName: null,
      }),
    ).toEqual(["—"]);
  });
  test("newlines and tabs are flattened: Meta rejects them in parameters", () => {
    expect(
      resolveParams([{ kind: "static", value: "a\nb\tc" }], recipient),
    ).toEqual(["a b c"]);
  });
});
```

**Step 2: Implementación**

```ts
import type { Recipient } from "./audience-filter";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";

const clean = (v: string | null | undefined): string => {
  const flat = (v ?? "").replace(/[\n\r\t]+/g, " ").trim();
  return flat === "" ? "—" : flat;
};

export function resolveParams(
  sources: WhatsAppParamSource[],
  recipient: Recipient,
  vars: Record<string, string> = {},
): string[] {
  return sources.map((s) => {
    if (s.kind === "static") return clean(s.value);
    switch (s.field) {
      case "first_name":
        return clean(recipient.firstName);
      case "last_name":
        return clean(recipient.lastName);
      default:
        return clean(vars[s.field]);
    }
  });
}
```

`service`, `session_type`, `date`, `time` llegan por `vars` (las ponen las reglas `after_booking`/`first_visit` en Task 13). Run tests → verde. Commit:

```bash
git add app/lib/campaigns/whatsapp-params.ts app/lib/campaigns/whatsapp-params.test.ts
git commit -m "feat(campaigns): template parameters resolved per recipient"
```

---

### Task 12: Envío por WhatsApp en `dispatch` y `automations`

**Files:**

- Create: `app/lib/campaigns/dispatch-whatsapp.ts`
- Modify: `app/lib/campaigns/dispatch.ts` (`QueuedRow`, `QUEUED_FIELDS`, `sendQueued`, `dispatchCampaign` donde congela la audiencia)
- Modify: `app/lib/campaigns/automations.ts` (`resolveAudience(campaign.audience, now, campaign.channel)` y el upsert con `phone`)

**Step 1: `dispatch-whatsapp.ts`**

```ts
import { getAdminClient } from "@/lib/insforge-admin";
import { sendTemplateMessage } from "@/lib/whatsapp/client";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import type { CampaignRow } from "@/types/campaign";
import type { QueuedRow } from "./dispatch";
import { resolveParams } from "./whatsapp-params";

const PER_SECOND = 10; // well under Meta's default 80 msg/s; keeps the cron inside its minute
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends every queued row of a WhatsApp campaign, one template message each,
 * and stamps `sent`/`failed` with Meta's `wamid` as `provider_id` so the
 * webhook can move the row on to delivered/read.
 */
export async function sendQueuedWhatsApp(
  campaign: CampaignRow,
  rows: QueuedRow[],
): Promise<{ sent: number; failed: number; lastError: string | null }> {
  const db = getAdminClient().database;
  const block = campaign.content.whatsapp;
  if (!block?.templateId)
    return { sent: 0, failed: rows.length, lastError: "no template" };

  const { data } = await db
    .from("whatsapp_templates")
    .select("*")
    .eq("id", block.templateId)
    .maybeSingle();
  const template = data as WhatsAppTemplateRow | null;
  if (!template || template.status !== "APPROVED") {
    return { sent: 0, failed: rows.length, lastError: "template not approved" };
  }

  let sent = 0,
    failed = 0,
    lastError: string | null = null;
  for (let i = 0; i < rows.length; i += PER_SECOND) {
    const chunk = rows.slice(i, i + PER_SECOND);
    const results = await Promise.all(
      chunk.map(async (row) => {
        const contact = Array.isArray(row.contacts)
          ? row.contacts[0]
          : row.contacts;
        const params = resolveParams(
          block.params,
          {
            id: row.contact_id ?? "",
            email: row.email ?? "",
            firstName: contact?.first_name ?? "",
            lastName: contact?.last_name ?? null,
            language: row.language,
            phone: row.phone,
          },
          row.vars ?? undefined,
        );
        return {
          row,
          result: await sendTemplateMessage({
            to: row.phone!,
            name: template.name,
            language: template.language,
            bodyParams: params,
          }),
        };
      }),
    );
    const at = new Date().toISOString();
    await Promise.all(
      results.map(({ row, result }) => {
        if (result.status === "sent") {
          sent += 1;
          return db
            .from("campaign_recipients")
            .update({
              status: "sent",
              provider_id: result.providerId,
              sent_at: at,
            })
            .eq("id", row.id);
        }
        failed += 1;
        lastError =
          result.status === "failed" ? result.error : "whatsapp not configured";
        return db
          .from("campaign_recipients")
          .update({ status: "failed", error: lastError })
          .eq("id", row.id);
      }),
    );
    if (i + PER_SECOND < rows.length) await pause(1000);
  }
  return { sent, failed, lastError };
}
```

**Step 2: En `dispatch.ts`**

- `QueuedRow` gana `email: string | null; phone: string | null;` y `contacts` incluye `last_name`. `QUEUED_FIELDS = "id, contact_id, email, phone, language, variant, vars, contacts(first_name, last_name, unsubscribe_token)"`.
- Al principio de `sendQueued`: `if (campaign.channel === "whatsapp") return sendQueuedWhatsApp(campaign, rows);`.
- Donde `dispatchCampaign` congela la audiencia (`resolveAudience(...)` y el insert de `campaign_recipients`): pasar `campaign.channel` y escribir `phone: recipient.phone ?? null, email: recipient.email || null`. Si `campaign.channel === "whatsapp"` y `!isWhatsAppConfigured()` → `markFailed(id, "whatsapp not configured")` y devolver `{ ok: false, error: "no_api_key" }` (mismo código que usa el email para Resend; el texto del dashboard ya existe).

**Step 3: En `automations.ts`**

`resolveAudience(campaign.audience, now, campaign.channel)` y el upsert con `phone: recipient.phone ?? null, email: recipient.email || null` y `onConflict` según canal: `"campaign_id,phone,cycle"` para whatsapp.

**Step 4: Verificar**

Run: `npx tsc --noEmit -p . && bun test && bun run lint` → limpio. Commit:

```bash
git add app/lib/campaigns/dispatch-whatsapp.ts app/lib/campaigns/dispatch.ts app/lib/campaigns/automations.ts
git commit -m "feat(campaigns): a WhatsApp campaign sends its template to every queued phone"
```

---

### Task 13: Reglas de automatización — variables de la reserva y un trigger "antes de la cita"

Para que una automatización de WhatsApp pueda decir "tu sesión de {{2}} es el {{3}} a las {{4}}", las reglas `after_booking` y `first_visit` deben poner `vars`. Y el caso de uso número uno de WhatsApp es el recordatorio, así que se añade `before_visit` (horas antes).

**Files:**

- Modify: `app/types/campaign.ts` (`TriggerEvent` + `"before_visit"`; `CampaignTrigger.hours` ya existe)
- Modify: `app/lib/campaigns/audience-filter.ts` (`Recipient` gana `nextVisit?: { startsAt: string; service: string; sessionType: string | null; date: string; time: string } | null` y `lastBookingService?`… — leer `loadCandidates` en `audience.ts` para ver qué columnas de `bookings` ya trae y añadir `service_title, service_tiers(label), time`)
- Modify: `app/lib/campaigns/automation-rules.ts`
- Modify: `app/lib/campaigns/automation-rules.test.ts`
- Modify: `app/lib/schemas.ts` (`campaignTriggerSchema.event` enum + `before_visit`)
- Modify: `app/(dashboard)/dashboard/campaigns/_form/trigger-step.tsx` (opción nueva con campo horas 1-168)
- Modify: `messages/{es,en}/dashboard.json` (`dashboard.campaigns.trigger.events.before_visit`)

**Step 1: Test que falla**

```ts
test("before_visit owes a message N hours before a confirmed booking, once per booking", () => {
  const now = new Date("2026-12-10T08:00:00Z");
  const r = recipient({
    nextVisit: {
      startsAt: "2026-12-11T08:00:00Z",
      service: "Drenaje",
      sessionType: null,
      date: "2026-12-11",
      time: "09:00",
    },
  });
  const due = dueRecipients({
    trigger: { event: "before_visit", hours: 24 },
    recipients: [r],
    activatedAt: "2026-12-01T00:00:00Z",
    now,
  });
  expect(due).toHaveLength(1);
  expect(due[0].cycle).toBe("2026-12-11T08:00:00Z");
  expect(due[0].vars).toMatchObject({
    service: "Drenaje",
    date: "11 de diciembre de 2026",
    time: "09:00",
  });
});
test("before_visit is not due while the booking is further away than the window", () => {
  const now = new Date("2026-12-09T07:00:00Z");
  const r = recipient({
    nextVisit: {
      startsAt: "2026-12-11T08:00:00Z",
      service: "Drenaje",
      sessionType: null,
      date: "2026-12-11",
      time: "09:00",
    },
  });
  expect(
    dueRecipients({
      trigger: { event: "before_visit", hours: 24 },
      recipients: [r],
      activatedAt: "2026-12-01T00:00:00Z",
      now,
    }),
  ).toHaveLength(0);
});
```

**Step 2: Regla**

```ts
case "before_visit": {
  const windowMs = (trigger.hours ?? 24) * 3_600_000;
  return recipients
    .filter((r) => {
      if (!r.nextVisit) return false;
      const starts = Date.parse(r.nextVisit.startsAt);
      // Due once we are inside the window and the visit is still ahead.
      return starts - now.getTime() <= windowMs && starts > now.getTime();
    })
    .map((recipient) => ({
      recipient,
      cycle: recipient.nextVisit!.startsAt,
      vars: visitVars(recipient.nextVisit!, recipient.language),
    }));
}
```

y `after_booking` / `first_visit` añaden `vars: visitVars(...)` con la última visita. `visitVars` usa `formatLongDate(date, locale)` de `@/lib/format-date` (ya existe, lo usa `whatsapp/messages.ts`).

**Correcciones obligatorias de esta tarea**

- `startsAt` se construye en **Atlantic/Canary**, igual que la regla `first_visit`, nunca con `new Date(date + "T" + time)`: en Vercel eso es UTC y se desfasa una hora en verano. Reutilizar el helper que ya usa `first_visit` para convertir fecha local + hora a instante, o `Intl` con `timeZone: "Atlantic/Canary"`.
- Los fixtures de los tests deben ser coherentes: 09:00 hora de Canarias en diciembre es `09:00Z`; en julio es `08:00Z`. Añadir un caso de verano.
- Solape: `before_visit` por WhatsApp y el recordatorio de la Task 21 mandan ambos un WhatsApp antes de la cita. En el paso del trigger, si el canal es WhatsApp y el evento `before_visit`, mostrar un aviso: "Si también tienes el recordatorio de WhatsApp activo en Mensajes, la clienta recibirá los dos."

**Step 3:** pasar tests, cablear `loadCandidates` (la siguiente reserva confirmada ≥ now por contacto), UI del trigger, i18n. Commit:

```bash
git commit -am "feat(campaigns): booking variables for the rules and a before_visit trigger"
```

---

### Task 14: Webhook Meta → `campaign_recipients`

**Files:**

- Modify: `app/api/webhooks/whatsapp/route.ts`

En el bucle que aplica `furthest` a `booking_events`, antes de tocar `booking_events`, probar primero en campañas:

```ts
const { data: moved } = await db.rpc("record_campaign_event", {
  p_provider_id: id,
  p_event: status.status, // delivered | read | failed
  p_at: isoFrom(status.timestamp),
  p_error: status.errors?.[0]?.message ?? null,
});
if (moved === true) continue; // it was a campaign message; booking_events has no row for it
```

Verificar con el script de Task 5 (payload `statuses` con un `wamid` de una fila de prueba). Commit:

```bash
git commit -am "feat(whatsapp): delivery and read receipts reach campaign recipients"
```

---

### Task 15: Formulario de campaña — elegir canal y mapear la plantilla

**Files:**

- Modify: `app/(dashboard)/dashboard/campaigns/_form/form-state.ts` (`channel` en `FormState`, acción `SET_CHANNEL`, `SET_WHATSAPP` `{ templateId, params }`)
- Modify: `app/(dashboard)/dashboard/campaigns/_form/type-step.tsx` (segmento Email / WhatsApp encima de las tarjetas; con WhatsApp, `split` y `rss` quedan deshabilitadas con tooltip: A/B no aplica a plantillas; RSS necesita `post_url` y Meta exige URL fija en botones)
- Create: `app/(dashboard)/dashboard/campaigns/_form/whatsapp-step.tsx` (sustituye a `template-step` + `content-step` cuando `channel === "whatsapp"`)
- Modify: `app/(dashboard)/dashboard/campaigns/_form/campaign-form.tsx` (`STEP_OF`, `persist` envía `channel` y `content.whatsapp`; `handleTest` llama a `sendTestWhatsAppCampaign`)
- Modify: `app/(dashboard)/dashboard/campaigns/_form/review-step.tsx` (tarjeta de contenido muestra la burbuja de previsualización; el coste: línea "Mensajes de plantilla con coste por destinatario según Meta" con enlace a https://developers.facebook.com/docs/whatsapp/pricing)
- Modify: `app/(dashboard)/dashboard/campaigns/_form/audience-step.tsx` (si whatsapp, el contador dice "N con WhatsApp autorizado" y el sub-recuento por idioma se mantiene)
- Modify: `app/actions/campaigns.ts` (`saveCampaign` persiste `channel`; `previewAudience` recibe canal; nueva `sendTestWhatsAppCampaign(accessToken, content)` que manda la plantilla al teléfono del admin con los ejemplos de la plantilla)
- Modify: `messages/{es,en}/dashboard.json`

**`whatsapp-step.tsx`:** desplegable de plantillas `APPROVED` del idioma de envío (`sendLocaleOf(audience)`); si no hay ninguna, enlace a `/dashboard/messages` "Crea y envía a revisión una plantilla". Debajo, una fila por `{{n}}`: selector _Campo del contacto_ (nombre, apellido, servicio, tipo de sesión, fecha, hora, título del post, enlace del post) o _Texto fijo_. A la derecha, la burbuja de previsualización con datos de ejemplo (Ana, Drenaje…).

**Step final:** `bun run dev`, crear campaña WhatsApp estándar con la plantilla de prueba aprobada, audiencia "Todos", "Enviarme una prueba" → llega al móvil del admin. Commit:

```bash
git commit -am "feat(dashboard): WhatsApp campaigns — pick the channel, the approved template and what fills it"
```

---

### Task 16: Lista, informe y ficha de contacto con el canal

**Files:**

- Modify: `app/(dashboard)/dashboard/campaigns/campaign-table.tsx` (icono/chip de canal)
- Modify: `app/(dashboard)/dashboard/campaigns/[id]/page.tsx` y `recipient-table.tsx` (columna Teléfono en vez de Email cuando `channel === "whatsapp"`; "Leídos" en vez de "Abiertos"; sin "Clics")
- Modify: `app/(dashboard)/dashboard/contacts/[id]/*` (la pestaña de campañas del contacto incluye las de WhatsApp: hoy filtra por `email`, debe unir por `contact_id`)
- Modify: `app/api/[transport]/tools/campaigns.ts` (los tools MCP de campañas exponen `channel` y aceptan `whatsapp` donde listan/crean; leer el archivo para los nombres exactos)

Commit: `feat(dashboard): campaign list, report and contact card know the channel`.

---

# FASE 3 — Emails transaccionales editables desde el dashboard

### Task 17: Migración `message_templates` + catálogo de eventos (puro)

**Files:**

- Create: `insforge/migrations/20261117d_message_templates.sql`
- Create: `app/lib/messages/catalog.ts`
- Create: `app/lib/messages/catalog.test.ts`

**Step 1: Migración**

```sql
-- One editable version of each transactional message, per channel and locale.
-- A missing row means "use the default in code", so nothing breaks before the
-- admin touches anything.
CREATE TABLE IF NOT EXISTS message_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,            -- booking_received | booking_confirmed | …
  channel     text NOT NULL,            -- email | whatsapp
  locale      text NOT NULL,            -- en | es
  enabled     boolean NOT NULL DEFAULT true,
  subject     text,                     -- email
  preheader   text,                     -- email
  title       text,                     -- email
  doc         jsonb,                    -- email body (Maily document)
  whatsapp_template_id uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  whatsapp_params jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, channel, locale)
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
```

**Step 2: Catálogo**

`app/lib/messages/catalog.ts` describe cada mensaje editable: clave, qué variables ofrece y qué bloques fijos añade el código después del cuerpo (tarjeta de detalles, botón de calendario, enlace de cancelación). Es la fuente de la pantalla y del renderizador.

```ts
export type MessageKey =
  | "booking_received"
  | "booking_confirmed"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "booking_reminder"
  | "consent_request"
  | "bonus_purchase";

export type MessageVariable =
  | "first_name"
  | "last_name"
  | "service"
  | "session_type"
  | "date"
  | "time"
  | "duration"
  | "amount_due"
  | "cancel_url"
  | "consent_url";

export type FixedBlock =
  "details_card" | "calendar_button" | "cancel_link" | "consent_button";

export const MESSAGE_CATALOG: Record<
  MessageKey,
  { variables: MessageVariable[]; fixed: FixedBlock[] }
> = {
  booking_received: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
    ],
    fixed: ["details_card"],
  },
  booking_confirmed: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
      "amount_due",
    ],
    fixed: ["details_card", "calendar_button", "cancel_link", "consent_button"],
  },
  booking_rescheduled: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
    ],
    fixed: ["details_card", "calendar_button", "cancel_link"],
  },
  booking_cancelled: {
    variables: ["first_name", "service", "date", "time"],
    fixed: [],
  },
  booking_reminder: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
    ],
    fixed: ["details_card", "calendar_button", "cancel_link"],
  },
  consent_request: {
    variables: ["first_name", "consent_url"],
    fixed: ["consent_button"],
  },
  bonus_purchase: {
    variables: ["first_name", "service", "amount_due"],
    fixed: [],
  },
};

/** `{{x}}` tokens a body uses that the message does not offer. */
export function unknownVariables(key: MessageKey, text: string): string[] {
  const offered = new Set<string>(MESSAGE_CATALOG[key].variables);
  const used = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) used.add(m[1]);
  return [...used].filter((v) => !offered.has(v));
}
```

Test: `unknownVariables("booking_cancelled", "Hola {{first_name}}, {{cancel_url}}")` → `["cancel_url"]`. Commit:

```bash
git commit -am "feat(messages): message_templates table and the catalogue of editable messages"
```

---

### Task 18: Defaults en código + renderizador común

Cada template actual se parte en dos: el **cuerpo por defecto** como documento Maily (lo que el admin podrá editar) y los **bloques fijos** que añade el código. Se renderiza con `campaignEmail()`, ampliado.

**Files:**

- Modify: `app/emails/templates/campaign.ts` (`campaignEmail` acepta `afterBody?: string` y `footer: "campaign" | "transactional"`; el pie transaccional no lleva "darse de baja")
- Create: `app/emails/defaults/booking-confirmed.ts` … uno por `MessageKey`, exportando `{ en: CampaignLocaleContent, es: CampaignLocaleContent }` construidos con `blocksToDoc()` de `app/lib/campaigns/doc.ts` a partir del texto actual de `app/emails/templates/*.ts`
- Create: `app/lib/messages/render.ts`:

```ts
export async function renderMessageEmail(opts: {
  key: MessageKey;
  locale: "en" | "es";
  vars: Partial<Record<MessageVariable, string>>;
  /** HTML for the fixed blocks, built by the caller from the booking. */
  fixedHtml: string;
}): Promise<{ subject: string; html: string } | null>;
```

que lee `message_templates` (fila `enabled`), cae a `DEFAULTS[key][locale]` si no hay fila, y devuelve `null` si la fila existe con `enabled = false`. **Solo `booking_reminder` se puede apagar**: para las demás claves el renderizador ignora `enabled` (apagar la confirmación dejaría a una clienta que ha pagado sin su correo). Las variables se rellenan con el mecanismo de `vars` que `campaignEmail` ya tiene (escapadas).

- Modify: `app/lib/bookings/notify.ts`, `app/api/cron/booking-reminders/route.ts`, `app/actions/*` que llamen a `consentRequestEmail` / `bonusPurchaseEmail`: sustituir la llamada al template por `renderMessageEmail` + los helpers de `_base.ts` para `fixedHtml`.
- Modify: `app/emails/templates/campaign.test.ts` (caso `footer: "transactional"` sin enlace de baja).

**Respaldo obligatorio:** cada llamador envuelve `renderMessageEmail` en `try/catch` y, si lanza o devuelve nada, usa la función antigua de `app/emails/templates/booking-*.ts`. Esas funciones **no se borran en esta tarea**: se retiran al final, en una tarea aparte, cuando el nuevo camino lleve probado en local de principio a fin.

**Verificación obligatoria:** `bun run build`, `bun run test` y probar una reserva en local (recibido + confirmado + recordatorio) comprobando que el HTML se ve igual que antes. Es el camino de una reserva ya pagada: si algo no se puede probar, se informa como no verificado. Commit:

```bash
git commit -am "refactor(emails): transactional bodies are Maily documents with code defaults and fixed blocks"
```

---

### Task 19: Server Actions de mensajes

**Files:**

- Create: `app/actions/message-templates.ts`: `listMessageTemplates`, `saveMessageTemplate(accessToken, { key, channel, locale, enabled, subject, preheader, title, doc, whatsappTemplateId, whatsappParams })`, `resetMessageTemplate` (borra la fila: vuelve al default), `sendTestMessage(accessToken, key, locale)` (renderiza con datos de ejemplo y lo envía al email o al móvil del admin).
- Modify: `app/lib/schemas.ts` (`messageTemplateSchema`: mismas reglas que `campaignLocaleContentSchema` + `unknownVariables` → `unknownVariable`).

Commit: `feat(messages): admin actions to edit, reset and test every transactional message`.

---

### Task 20: Pestaña "Emails" en `/dashboard/messages`

**Files:**

- Create: `app/(dashboard)/dashboard/messages/email/message-list.tsx` (una fila por `MessageKey` × idioma: nombre legible, "Personalizado" / "Por defecto", interruptor Activo **solo en `booking_reminder`**, Editar, Enviarme prueba)
- Create: `app/(dashboard)/dashboard/messages/email/message-editor.tsx` (reutiliza el editor Maily del `content-step` de campañas — extraer el componente a `app/components/dashboard/maily-editor.tsx` si aún está incrustado; chips con las variables disponibles del catálogo que insertan `{{var}}`; previsualización `email-preview.tsx` reutilizada; botón "Restablecer por defecto")
- Modify: `messages-tabs.tsx`, i18n `dashboard.messages.email.*` y nombres legibles `dashboard.messages.keys.*`

Commit: `feat(dashboard): transactional emails are edited, previewed and tested from Messages`.

---

# FASE 4 — WhatsApp transaccional al cliente

### Task 21: Enviar la plantilla elegida en los eventos de reserva

Con `message_templates` (channel `whatsapp`) el admin asocia, por ejemplo, `booking_confirmed/es` a la plantilla aprobada `cita_confirmada` y mapea `{{1}}`→nombre, `{{2}}`→servicio, `{{3}}`→fecha, `{{4}}`→hora.

**Files:**

- Create: `app/lib/whatsapp/notify-client.ts`: `notifyClientOnWhatsApp({ bookingId, key, locale, vars, actorId, actorRole })` — lee la fila `message_templates` + `whatsapp_templates` (APPROVED), comprueba el opt-in del contacto por email de la reserva, resuelve params con `resolveParams`, `sendTemplateMessage`, y `recordBookingEvent({ channel: "whatsapp", event, recipient: phone, summary: renderPreview(body, params), providerId })`. Nunca lanza.
- Modify: `app/lib/bookings/notify.ts` (`notifyBookingCore`: tras el email, `await notifyClientOnWhatsApp(...)` si `payload.clientPhone`)
- Modify: `app/api/cron/booking-reminders/route.ts` (igual, clave `booking_reminder`)
- Modify: `app/(dashboard)/dashboard/messages/email/*` → la lista pasa a mostrar, por clave, dos filas: Email y WhatsApp; la de WhatsApp abre el mismo mapeador de parámetros de `whatsapp-step.tsx` (extraerlo a `app/components/dashboard/whatsapp-param-mapper.tsx` en esta tarea)

Verificar con una reserva de prueba con un móvil con opt-in: llega el WhatsApp y aparece en el historial de la reserva con estado `sent` → `delivered` → `read`. Commit:

```bash
git commit -am "feat(whatsapp): clients get the confirmation and the reminder on the template the admin chose"
```

---

### Task 22: Cierre — docs, `llms`, CLAUDE.md, memoria de Meta

**Files:**

- Modify: `CLAUDE.md` (sección "Email Campaigns" → "Campaigns (email + WhatsApp)" con: canal, `whatsapp_templates`, opt-in, `message_templates` y la regla "los textos transaccionales viven en BD con default en código")
- Modify: `env.example` (ya hecho en Task 1; revisar)
- Create: `docs/plans/2026-11-17-whatsapp-go-live.md`: pasos manuales — verificar el número en Meta Business, categoría de cada plantilla, suscribir los campos `messages`, `message_template_status_update` y `message_deliveries` en el webhook de la app de Meta, pedir aumento de límite de conversaciones, y enlazar a la página de precios.

Commit: `docs: campaigns by channel, editable messages and the WhatsApp go-live checklist`.

---

## Fuera de alcance (a propósito)

- Bandeja de entrada de WhatsApp en el dashboard (conversaciones de ida y vuelta). El centro responde a mano desde el móvil; solo se procesan bajas.
- Plantillas con cabecera de imagen o documento. Solo texto; es lo que las campañas del centro necesitan y lo único que la previsualización sabe dibujar.
- A/B (`split`) y RSS por WhatsApp.
- Emails de cuenta (`account-locked`, `account-unlocked`), aviso al staff (`staff-new-booking`) y formulario de contacto: siguen en código. Son del sistema, no del cliente.
- Facturación/coste estimado por campaña: Meta cambia tarifas por país y categoría; se enlaza, no se calcula.

## Riesgos y cómo los cubre el plan

| Riesgo                                                      | Mitigación                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Plantilla rechazada o pausada por Meta en mitad de un envío | `sendQueuedWhatsApp` solo envía con `APPROVED`; el webhook actualiza el estado; la campaña queda `failed` con `last_error` legible. |
| Enviar marketing sin opt-in (bloqueo de la cuenta por Meta) | La audiencia excluye sin `whatsapp_opted_in_at`; STOP/BAJA estampa la baja; categoría visible al crear la plantilla.                |
| Doble envío al reanudar                                     | Mismo mecanismo que email: solo filas `queued`; índice único `(campaign_id, phone, cycle)`.                                         |
| Un admin edita un email y rompe el HTML                     | El cuerpo es un documento Maily, no HTML; los bloques con lógica (tarjeta, botones) son fijos; "Restablecer" vuelve al default.     |
| Variables desconocidas en un texto                          | `unknownVariables` en validación; chips con las permitidas.                                                                         |
| El cron supera su minuto con muchos mensajes                | 10 msg/s ⇒ 600 por tick; lo que sobra queda `queued` y sale en el siguiente, como ya ocurre con el email.                           |
